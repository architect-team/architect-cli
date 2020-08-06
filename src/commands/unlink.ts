import { flags } from '@oclif/command';
import chalk from 'chalk';
import path from 'path';
import Command from '../base-command';

export default class Unlink extends Command {
  auth_required() {
    return false;
  }

  static description = 'Unlink a service from the host by path or name';

  static flags = {
    ...Command.flags,
    all: flags.boolean({
      description: 'Unlink all services registered locally',
    }),
  };

  static args = [{
    name: 'servicePathOrName',
    char: 'p',
    default: path.basename(process.cwd()),
    parse: (value: string) => value.toLowerCase(),
    required: false,
  }];

  async run() {
    const { args, flags } = this.parse(Unlink);

    if (flags.all) {
      this.app.unlinkAllServices();
      this.log(chalk.green('Successfully purged all linked services'));
      return;
    }

    const removedServiceName = this.app.unlinkService(args.servicePathOrName);
    if (!removedServiceName) {
      this.log(chalk.red(`No linked service found matching, ${args.servicePathOrName}`));
    } else {
      this.log(chalk.green(`Successfully unlinked ${removedServiceName}`));
    }
  }
}
