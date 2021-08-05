import Command, { flags } from '@oclif/command';
import 'reflect-metadata';
import AppService from './app-config/service';
import LoginRequiredError from './common/errors/login-required';
import { ArchitectError } from './dependency-manager/src/utils/errors';

const DEPRECATED_LABEL = '[deprecated]';

export default abstract class extends Command {
  static readonly DEPRECATED: string = DEPRECATED_LABEL;

  app!: AppService;
  accounts?: any;

  auth_required() {
    return true;
  }

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  checkFlagDeprecations(flags: any, flagDefinitions: any) {
    Object.keys(flags).forEach((flagName: string) => {
      const description: string = flagDefinitions[flagName].description
      if (description?.startsWith(DEPRECATED_LABEL)) {
        this.warn(`Flag --${flagName} is deprecated.${description.split(DEPRECATED_LABEL)[1]}`);
      }
    });
  }

  async init() {
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

  async catch(err: any) {
    if (err.oclif && err.oclif.exit === 0) return;

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

    this.error(message);
  }
}
