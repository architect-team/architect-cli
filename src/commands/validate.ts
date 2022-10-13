import { Interfaces } from '@oclif/core';
import chalk from 'chalk';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import { buildSpecFromPath } from '../';
import BaseCommand from '../base-command';
import MissingContextError from '../common/errors/missing-build-context';

tmp.setGracefulCleanup();

export default class ComponentValidate extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static aliases = ['component:validate', 'components:validate', 'c:validate', 'comp:validate', 'validate'];
  static description = 'Validate that an architect.yml is syntactically correct.';
  static examples = [
    'architect validate .',
    'architect validate ../mycomponent/architect.yml ../myothercomponent/architect.yml',
  ];
  static flags = {
    ...BaseCommand.flags,
  };

  static args = [{
    sensitive: false,
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    parsed.args.configs_or_components = parsed.argv;

    // Merge any values set via deprecated flags into their supported counterparts
    const flags: any = parsed.flags;
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { args } = await this.parse(ComponentValidate);

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
      const component_spec = buildSpecFromPath(config_path);
      this.log(chalk.green(`✅ ${component_spec.name}: ${component_spec.metadata.file?.path}`));
    }
  }
}
