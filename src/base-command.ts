import Command, { flags } from '@oclif/command';
import chalk from 'chalk';
import 'reflect-metadata';
import AppService from './app-config/service';
import LoginRequiredError from './common/errors/login-required';

export default abstract class extends Command {
  app!: AppService;
  accounts?: any;

  auth_required() {
    return true;
  }

  static flags = {
    help: flags.help({ char: 'h' }),
  };

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

    if (!err.message) { err.message = 'Error: '; }

    if (err.response?.data instanceof Object) {
      let error_msg = `${err.request.path} (${err.response.status})`;
      for (const [k, v] of Object.entries(err.response.data)) {
        error_msg += `\n${k}: ${v}`;
      }
      this.error(chalk.red(error_msg));
    } else if (err.config) {
      err.message += `${err.config.url} [${err.config.method}]`;
    } else if (err.stderr) {
      err.message += err.stderr;
    }

    this.error(err);
  }
}
