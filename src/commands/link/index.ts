import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import { buildSpecFromPath } from '../..';
import BaseCommand from '../../base-command';

declare const process: NodeJS.Process;

export default class Link extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Link a local component to the host to be used to power local deployments.';

  static flags = {
    ...BaseCommand.flags,
  };

  static args = [{
    sensitive: false,
    name: 'componentPath',
    char: 'p',
    description: 'The path of the component to link',
    default: '.',
  }];

  async run(): Promise<void> {
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
  }
}
