import { Command, Config, Interfaces } from '@oclif/core';
import '@sentry/tracing';
import chalk from 'chalk';
import { ValidationErrors } from '.';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import SentryService from './sentry';

const DEPRECATED_LABEL = '[deprecated]';

export default abstract class BaseCommand extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app: AppService;
  sentry: SentryService;

  async auth_required(): Promise<boolean> {
    return true;
  }

  checkFlagDeprecations(flags: any, flag_definitions: any): void {
    Object.keys(flags).forEach((flagName: string) => {
      const flag_config = flag_definitions[flagName] || {};
      const description = flag_config.description || '';
      if (description?.startsWith(DEPRECATED_LABEL)) {
        this.warn(`Flag --${flagName} is deprecated.${description.split(DEPRECATED_LABEL)[1]}`);
      }
    });
  }

  constructor(argv: string[], config: Config) {
    super(argv, config);
    this.app = AppService.create(this.config.configDir, this.config.userAgent.split(/\/|\s/g)[2]);
    this.sentry = new SentryService(this);
  }

  // override debug being a protected method on the oclif Command class
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  debug(...args: any[]): void {
    return super.debug(...args);
  }

  async init(): Promise<void> {
    const command_class = this.getClass();
    const { flags } = await this.parse(command_class);
    const flag_definitions = command_class.flags;
    this.checkFlagDeprecations(flags, flag_definitions);

    await this.app.auth.init();

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
    await this.sentry.startSentryTransaction();
  }

  // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const flag_definitions = this.getClass().flags;

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

  async finally(err: Error | undefined): Promise<any> {
    await this.sentry.endSentryTransaction(err);

    // Oclif supers go as the return
    return super.finally(err);
  }

  async catch(error: any): Promise<void> {
    if (error.oclif && error.oclif.exit === 0) return;

    try {
      if (error.stack) {
        error.stack = [...new Set(error.stack.split('\n'))].join("\n");
      }

      if (error instanceof ValidationErrors) {
        prettyValidationErrors(error);
        return super.catch({ ...error, message: '' });
      }

      if (error.response?.data instanceof Object) {
        error.message += `\nmethod: ${error.config.method}`;
        for (const [k, v] of Object.entries(error.response.data)) {
          try {
            const msg = JSON.parse(v as any).message;
            if (!msg) { throw new Error('Invalid msg'); }
            error.message += `\n${k}: ${msg}`;
          } catch {
            error.message += `\n${k}: ${v}`;
          }
        }
      }

      if (error.stderr) {
        error.message += `\nstderr:\n${error.stderr}\n`;
      }

      console.error(chalk.red(error.message));
    } catch {
      this.debug('Unable to add more context to error message');
    }
    // Oclif supers go as the return
    return super.catch(error);
  }

  getClass(): typeof BaseCommand {
    return this.constructor as any;
  }
}
