import Command, { flags } from '@oclif/command';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import 'reflect-metadata';
import { CREDENTIAL_PREFIX } from './app-config/auth';
import AppConfig from './app-config/config';
import CredentialManager from './app-config/credentials';
import AppService from './app-config/service';
import ARCHITECTPATHS from './paths';

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

      if (this.auth_required()) {
        const config_dir = this.config.configDir;
        let config: AppConfig = new AppConfig(config_dir);
        if (config_dir) {
          const config_file = path.join(config_dir, ARCHITECTPATHS.CLI_CONFIG_FILENAME);
          if (fs.existsSync(config_file)) {
            const payload = fs.readJSONSync(config_file);
            config = new AppConfig(config_dir, payload);
          }
        }

        const credentials = new CredentialManager(config);
        const credential = await credentials.get(CREDENTIAL_PREFIX);
        if (!credential) {
          this.error(chalk.red(`Please log in using 'architect login'`));
        }
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
