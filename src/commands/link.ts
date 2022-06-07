import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath } from '../';
import Command from '../base-command';

declare const process: NodeJS.Process;

export default class Link extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Link a local component to the host to be used to power local deployments.';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'componentPath',
    char: 'p',
    default: '.',
  }];

  static sensitive = new Set();

  static non_sensitive = new Set([...Object.keys({ ...this.flags }), ...this.args.map(arg => arg.name)]);

  async run(): Promise<void> {
    try {
      const { args } = await this.parse(Link);

      const component_path = path.resolve(untildify(args.componentPath));
      // Try to load the component from the path to ensure it exists and is valid
      try {
        const component_config = buildSpecFromPath(component_path);
        this.app.linkComponentPath(component_config.name, component_path);
        this.log(`Successfully linked ${chalk.green(component_config.name)} to local system at ${chalk.green(component_path)}.`);
      } catch (err: any) {
        if (err.name === 'missing_config_file') {
          this.log(chalk.red(err.message));
        } else {
          throw err;
        }
      }
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}
