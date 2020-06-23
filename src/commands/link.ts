import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import { ComponentConfigBuilder } from '../dependency-manager/src/component-config/builder';

declare const process: NodeJS.Process;

export default class Link extends Command {
  auth_required() {
    return false;
  }

  static description = 'Link a local service to the host to be used to power local deployments.';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'servicePath',
    char: 'p',
    default: path.basename(process.cwd()),
  }];

  async run() {
    const { args } = this.parse(Link);

    const servicePath = path.resolve(untildify(args.servicePath));

    // Try to load the service from the path to ensure it exists and is valid
    try {
      const component_config = await ComponentConfigBuilder.buildFromPath(servicePath);
      this.app.linkServicePath(component_config.getName(), servicePath);
      this.log(`Successfully linked ${chalk.green(component_config.getName())} to local system at ${chalk.green(servicePath)}.`);
    } catch (err) {
      if (err.name === 'missing_config_file') {
        this.log(chalk.red(err.message));
      } else {
        throw err;
      }
    }
  }
}
