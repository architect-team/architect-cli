import chalk from 'chalk';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import { Slugs } from '../dependency-manager/src';
import { buildConfigFromPath } from '../dependency-manager/src/spec/utils/component-builder';

declare const process: NodeJS.Process;

export default class Link extends Command {
  auth_required() {
    return false;
  }

  static description = 'Link a local component to the host to be used to power local deployments.';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'componentPath',
    char: 'p',
    default: path.basename(process.cwd()),
  }];

  async run() {
    const { args } = this.parse(Link);

    const component_path = path.resolve(untildify(args.componentPath));

    // Try to load the component from the path to ensure it exists and is valid
    try {
      const { component_config } = buildConfigFromPath(component_path, Slugs.DEFAULT_TAG);
      this.app.linkComponentPath(component_config.name, component_path);
      this.log(`Successfully linked ${chalk.green(component_config.name)} to local system at ${chalk.green(component_path)}.`);
    } catch (err) {
      if (err.name === 'missing_config_file') {
        this.log(chalk.red(err.message));
      } else {
        throw err;
      }
    }
  }
}
