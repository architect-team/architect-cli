import { flags } from '@oclif/command';
import chalk from 'chalk';
import path from 'path';
import Command from '../base-command';

export default class Unlink extends Command {
  auth_required() {
    return false;
  }

  static description = 'Unlink a component from the host by path or name';

  static flags = {
    ...Command.flags,
    all: flags.boolean({
      description: 'Unlink all components registered locally',
    }),
  };

  static args = [{
    name: 'componentPathOrName',
    char: 'p',
    default: path.basename(process.cwd()),
    parse: (value: string) => value.toLowerCase(),
    required: false,
  }];

  async run() {
    const { args, flags } = this.parse(Unlink);

    if (flags.all) {
      this.app.unlinkAllComponents();
      this.log(chalk.green('Successfully purged all linked components'));
      return;
    }

    const removedComponentName = this.app.unlinkComponent(args.componentPathOrName);
    if (!removedComponentName) {
      this.log(chalk.red(`No linked component found matching, ${args.componentPathOrName}`));
    } else {
      this.log(chalk.green(`Successfully unlinked ${removedComponentName}`));
    }
  }
}
