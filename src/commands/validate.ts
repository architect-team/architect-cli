import chalk from 'chalk';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import Command from '../base-command';
import MissingContextError from '../common/errors/missing-build-context';
import { buildConfigFromPath, Slugs } from '../dependency-manager/src';

tmp.setGracefulCleanup();

export default class ComponentValidate extends Command {
  static aliases = ['component:validate', 'components:validate', 'c:validate', 'comp:validate', 'validate'];
  static description = 'Validate that an architect.yml is syntactically correct.';

  static flags = {
    ...Command.flags,
  };

  static args = [{
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  parse(options: any, argv = this.argv): any {
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = super.parse(options, argv);
    parsed.args.configs_or_components = parsed.argv;

    // Merge any values set via deprecated flags into their supported counterparts
    const flags: any = parsed.flags;
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(ComponentValidate);

    const config_paths: Set<string> = new Set();

    if (args.configs_or_components) {
      for (let config_path of args.configs_or_components) {
        if (this.app.linkedComponents[config_path]) {
          config_path = this.app.linkedComponents[config_path];
        }
        config_path = path.resolve(untildify(config_path));
        config_paths.add(config_path);
      }
    }

    if (config_paths.size <= 0) {
      throw new MissingContextError();
    }

    for (const config_path of config_paths) {
      const { component_config, source_path } = buildConfigFromPath(config_path, Slugs.DEFAULT_TAG);
      this.log(chalk.green(`✅ ${component_config.name}: ${source_path}`));
    }
  }
}
