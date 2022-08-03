import { Command, Interfaces } from '@oclif/core';
import '@sentry/tracing';
import AppService from './app-config/service';
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

  async disable_sentry_recording(): Promise<boolean> {
    return false;
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

  private async ignoreTryCatch(fn: () => Promise<void>, debug_message: string) {
    try {
      await fn();
    } catch {
      this.debug(debug_message);
    }
  }

  private async createSentry() {
    await this.ignoreTryCatch(async () => {
      this.sentry = await SentryService.create(this.app, this.constructor as any, this.debug.bind(this));
    }, 'SENTRY: an error occurred creating a new instance of SentryService');
  }

  private async loginRequired() {
    await this.createSentry();
    throw new LoginRequiredError();
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
          return await this.loginRequired();
        }
        if (token_json.email === 'unknown') {
          return await this.loginRequired();
        }
        if (token_json.expires_in) {
          const auth_client = this.app.auth.getAuthClient();
          const access_token = auth_client.createToken(token_json);
          if (access_token.expired()) {
            return await this.loginRequired();
          }
        }
      }

      await this.createSentry();
    }
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

  async finally(err: Error | undefined): Promise<any> {
    const calling_class = this.constructor as any;
    await this.ignoreTryCatch(async () => {
      await this.sentry?.endSentryTransaction(!(await this.disable_sentry_recording()), await this.parse(calling_class), calling_class, err);
    }, 'SENTRY: Error occurred on ending transaction');
    // Oclif supers go as the return
    return super.finally(err);
  }

  async catch(err: any): Promise<void> {
    if (err.oclif && err.oclif.exit === 0) return;
    await this.ignoreTryCatch(async () => {
      await this.sentry?.catch(err);
    }, 'SENTRY: Error occurred on catch');
    // Oclif supers go as the return
    return super.catch(err);
  }
}
