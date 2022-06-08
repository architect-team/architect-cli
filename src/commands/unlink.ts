import { Flags } from '@oclif/core';
import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath } from '../';
import Command from '../base-command';
import { ToSentry } from '../sentry';

@ToSentry(Error,
  (err, ctx) => {
    const error = err as any;
    error.stack = Error(ctx.id).stack;
    return error;
})
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
    default: '.',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
    required: false,
  }];

  static sensitive = new Set();

  static non_sensitive = new Set([...Object.keys({ ...Unlink.flags }), ...Unlink.args.map(arg => arg.name)]);

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Unlink);

    if (flags.all) {
      this.app.unlinkAllComponents();
      this.log(chalk.green('Successfully purged all linked components'));
      return;
    }

    if (args.componentPathOrName === '.' || args.componentPathOrName.toLowerCase().endsWith("architect.yml")) {
      const component_path = path.resolve(untildify(args.componentPathOrName));
      try {
        const component_config = buildSpecFromPath(component_path);
        args.componentPathOrName = component_config.name;
      } catch (err: any) {
        this.log(chalk.red('Unable to locate architect.yml file'));
        return;
      }
    }

    const removedComponentName = this.app.unlinkComponent(args.componentPathOrName);
    if (!removedComponentName) {
      this.log(chalk.red(`No linked component found matching, ${args.componentPathOrName}`));
    } else {
      this.log(chalk.green(`Successfully unlinked ${removedComponentName}`));
    }
  }
}
