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
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const {args} = this.parse(Link);

    const servicePath = path.resolve(untildify(args.servicePath));

    // Try to load the service from the path to ensure it exists and is valid
    const config = ServiceConfigBuilder.buildFromPath(servicePath);
    this.app.linkServicePath(config.getName(), servicePath);
    this.log(chalk.green(`Successfully linked ${config.getName()} to local system at ${servicePath}.`));
  }
}
