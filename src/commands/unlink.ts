import { Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'path';
import Command from '../base-command';

export default class Unlink extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Unlink a component from the host by path or name';

  static flags = {
    ...Command.flags,
    all: Flags.boolean({
      description: 'Unlink all components registered locally',
    }),
  };

  static args = [{
    name: 'componentPathOrName',
    char: 'p',
    default: path.basename(process.cwd()),
    parse: async (value: string): Promise<string> => value.toLowerCase(),
    required: false,
  }];

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Unlink);

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
