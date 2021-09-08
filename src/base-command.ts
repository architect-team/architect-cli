import Command, { flags } from '@oclif/command';
import 'reflect-metadata';
import AppService from './app-config/service';
import { prettyValidationErrors } from './common/dependency-manager/validation';
import LoginRequiredError from './common/errors/login-required';
import { ArchitectError, isValidationErrorString, ValidationErrors } from './dependency-manager/src/utils/errors';

const DEPRECATED_LABEL = '[deprecated]';

export default abstract class extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app!: AppService;
  accounts?: any;

  auth_required(): boolean {
    return true;
  }

  static flags = {
    help: flags.help({ char: 'h' }),
  };

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
    const { flags } = this.parse(this.constructor as any);
    const flag_definitions = (this.constructor as any).flags;
    this.checkFlagDeprecations(flags, flag_definitions);

    if (!this.app) {
      this.app = await AppService.create(this.config.configDir, this.config.userAgent.split(/\/|\s/g)[2]);
      if (this.auth_required()) {
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
  }

  // Move all args to the front of the argv to get around: https://github.com/oclif/oclif/issues/190
  parse(options: any, argv = this.argv): any {
    const flag_definitions = (this.constructor as any).flags;

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

    if (err instanceof ValidationErrors) {
      return prettyValidationErrors(err);
    }

    if (err.response?.data?.message && isValidationErrorString(err.response?.data?.message)) {
      const validation_errors = JSON.parse(err.response?.data?.message);
      return prettyValidationErrors(new ValidationErrors(validation_errors));
    }

    let message = '';
    if (err.config) {
      message += `${err.config.url} [${err.config.method}] `;
    }

    if (err.response?.data instanceof Object) {
      message += `${err.request.path} (${err.response.status})`;
      for (const [k, v] of Object.entries(err.response.data)) {
        message += `\n${k}: ${v}`;
      }
    } else if (err.stderr) {
      message += err.stderr;
    } else if (err.stack && !(err instanceof ArchitectError)) {
      message += err.stack.replace('Error: ', '');
    } else {
      message += err.message || 'Unknown error';
    }
    this.error(err.name + '\n' + message);
  }
}
