import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import { ServiceConfigBuilder } from '../dependency-manager/src';

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
      const config = ServiceConfigBuilder.buildFromPath(servicePath);
      await config.validateOrReject();
      this.app.linkServicePath(config.getName(), servicePath);
      this.log(`Successfully linked ${chalk.green(config.getName())} to local system at ${chalk.green(servicePath)}.`);
    } catch (err) {
      if (err.name === 'missing_config_file') {
        this.log(chalk.red(err.message));
      } else {
        throw err;
      }
    }
  }
}
