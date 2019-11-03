import 'reflect-metadata';
import Command, { flags } from '@oclif/command';
import path from 'path';
import fs from 'fs-extra';
import {plainToClass} from 'class-transformer';
import ServiceConfig from './common/service-config';
import ARCHITECTPATHS from './paths';
import AppService from './app-config/service';
import chalk from 'chalk';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No config file found at ${filepath}`;
  }
}

export default abstract class extends Command {
  app!: AppService;

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  private getFormattedJSON(obj: object) {
    return JSON.stringify(obj, null, 2);
  }

  protected getServiceConfig(servicePath: string): ServiceConfig {
    const configPath = path.join(servicePath, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    if (!fs.existsSync(configPath)) {
      throw new MissingConfigFileError(configPath);
    }
    const configPayload = fs.readJSONSync(configPath) as object;
    return plainToClass(ServiceConfig, configPayload);
  }

  protected saveServiceConfig(servicePath: string, config: ServiceConfig) {
    const configPath = path.join(servicePath, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    fs.writeJSONSync(configPath, config, {
      spaces: 2,
    });
  }

  async init() {
    if (!this.app) {
      this.app = await AppService.create(this.config.configDir);
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
}
