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
      const token = await this.app.auth.getToken();
      if (this.auth_required() && (!token || (token.account === 'unknown' && token.password === 'unknown'))) {
        throw new LoginRequiredError();
      }
    }
  }

  async catch(err: any) {
    if (err.oclif && err.oclif.exit === 0) return;

    if (!err.message) { err.message = 'Error: '; }

    if (err.reponse?.data instanceof Object) {
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
