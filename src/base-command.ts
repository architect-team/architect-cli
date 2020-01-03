import Command, { flags } from '@oclif/command';
import chalk from 'chalk';
import 'reflect-metadata';
import AppService from './app-config/service';

export default abstract class extends Command {
  app!: AppService;
  accounts?: any;

  auth_required() {
    return true;
  }

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  private getFormattedJSON(obj: object) {
    return JSON.stringify(obj, null, 2);
  }

  async init() {
    if (!this.app) {
      this.app = await AppService.create(this.config.configDir);

      if (this.auth_required() && !await this.app.auth.getToken()) {
        this.error(chalk.red(`Please log in using 'architect login'`));
      }
    }
  }

  async catch(err: any) {
    if (err.oclif && err.oclif.exit === 0) return;

    if (err.response && err.response.data) {
      this.error(chalk.red(this.getFormattedJSON(err.response.data)));
    }
    if (this.app.config.log_level === 'debug') {
      throw err;
    } else {
      this.error(chalk.red(err.message || err));
    }
  }

  async get_accounts() {
    if (!this.accounts) {
      this.accounts = (await this.app.api.get('/accounts')).data;
    }
    return this.accounts;
  }
}
