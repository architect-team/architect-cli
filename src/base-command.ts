import { Command, Interfaces } from '@oclif/core';
import '@sentry/tracing';
import chalk from 'chalk';
import { ValidationErrors } from './';
import { ENVIRONMENT } from './app-config/config';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import SentryService from './sentry';

const DEPRECATED_LABEL = '[deprecated]';

export default abstract class BaseCommand extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app!: AppService;
  accounts?: any;
  sentry!: SentryService;

  async auth_required(): Promise<boolean> {
    return true;
  }

  static flags = {};

  checkFlagDeprecations(flags: any, flag_definitions: any): void {
    Object.keys(flags).forEach((flagName: string) => {
      const flag_config = flag_definitions[flagName] || {};
      const description = flag_config.description || '';
      if (description?.startsWith(DEPRECATED_LABEL)) {
        this.warn(`Flag --${flagName} is deprecated.${description.split(DEPRECATED_LABEL)[1]}`);
      }
    });
  }

  async init(): Promise<void> {
    const { flags } = await this.parse(this.constructor as any);
    const flag_definitions = (this.constructor as any).flags;
    this.checkFlagDeprecations(flags, flag_definitions);

    if (!this.app) {
      this.app = await AppService.create(this.config.configDir, this.config.userAgent.split(/\/|\s/g)[2]);
      if (await this.auth_required()) {
        const token_json = await this.app.auth.getPersistedTokenJSON();
        if (!token_json) {
          throw new LoginRequiredError();
        }
        if (token_json.email === 'unknown') {
          throw new LoginRequiredError();
        }
        if (token_json.expires_in) {
          const auth_client = this.app.auth.getAuthClient();
          const access_token = auth_client.createToken(token_json);
          if (access_token.expired()) {
            throw new LoginRequiredError();
          }
        }
      }
    }
    try {
      this.sentry = await SentryService.create(this.app, this.constructor as any);
    } catch (e) {
      // dont fail when adding metadata
    }
  }

  async finally(_: Error | undefined): Promise<any> {
    return await this.endSentryTransaction();
  }

  // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const flag_definitions = (this.constructor as any).flags;

    // Support -- input ex. architect exec -- ls -la
    const double_dash_index = argv.indexOf('--');
    if (double_dash_index >= 0) {
      const command = argv.slice(double_dash_index + 1, argv.length).join(' ');
      argv = argv.slice(0, double_dash_index);
      argv.unshift(command);
    }

    const args = [];
    const flags = [];
    let flag_option = false;
    for (const arg of argv) {
      const is_flag = arg.startsWith('-');

      if (is_flag || flag_option) {
        flags.push(arg);
      } else {
        args.push(arg);
      }

      if (is_flag) {
        const flag = arg.startsWith('--') ? flag_definitions[arg.replace('--', '')] : Object.values(flag_definitions).find((f: any) => f.char === arg.replace('-', ''));
        flag_option = flag?.type === 'option';
      } else {
        flag_option = false;
      }
    }

    return super.parse(options, [...args, ...flags]);
  }

  async catch(err: any): Promise<void> {
    if (err.oclif && err.oclif.exit === 0) return;

    try {

      if (err.stack) {
        err.stack = [...new Set(err.stack.split('\n'))].join("\n");
      }

      if (err instanceof ValidationErrors) {
        return prettyValidationErrors(err);
      }

      if (err.response?.data instanceof Object) {
        err.message += `\nmethod: ${err.config.method}`;
        for (const [k, v] of Object.entries(err.response.data)) {
          try {
            const msg = JSON.parse(v as any).message;
            if (!msg) { throw new Error('Invalid msg'); }
            err.message += `\n${k}: ${msg}`;
          } catch {
            err.message += `\n${k}: ${v}`;
          }
        }
      }

      if (err.stderr) {
        err.message += `\nstderr:\n${err.stderr}\n`;
      }

      console.error(chalk.red(err.message));

    } catch {
      this.warn('Unable to add more context to error message');
    }
    const app_env = this.app?.config?.environment;
    if (!this.sentry || !app_env || app_env === ENVIRONMENT.TEST) {
      return super.catch(err);
    }
    return await this.endSentryTransaction(err);
  }

  async _filterNonSensitiveSentryMetadata(non_sensitive: Set<string>, metadata: any): Promise<any> {
    return Object.entries(metadata)
      .filter((value,) => !!value[1] && non_sensitive.has(value[0]))
      .map(key => ({ [key[0]]: key[1] }));
  }

  async endSentryTransaction(err?: any): Promise<any> {
    const app_env = this.app?.config?.environment;
    if (!this.sentry || !app_env || app_env === ENVIRONMENT.TEST) {
      return err;
    }

    const calling_class = this.constructor as any;

    const non_sensitive = new Set([
      ...Object.entries(calling_class.flags || {}).filter(([_, value]) => (value as any).non_sensitive).map(([key, _]) => key),
      ...Object.entries(calling_class.args || {}).filter(([_, value]) => (value as any).non_sensitive).map(([_, value]) => (value as any).name),
    ]);

    try {
      const { args, flags } = await this.parse(calling_class);
      const filtered_sentry_args = await this._filterNonSensitiveSentryMetadata(non_sensitive, args);
      const filtered_sentry_flags = await this._filterNonSensitiveSentryMetadata(non_sensitive, flags);

      await this.sentry.setScopeExtra('command_args', filtered_sentry_args);
      await this.sentry.setScopeExtra('command_flags', filtered_sentry_flags);
    } catch {
      this.warn('Failed to get command metadata');
    }

    await this.sentry.endSentryTransaction(err);

    if (!err) {
      return await super.finally(err);
    }
    return await super.catch(err);
  }

}
