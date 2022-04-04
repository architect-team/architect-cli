/* eslint-disable no-empty */
import { Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { validateOrRejectSpec } from '../';
import Command from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { ComposeConverter } from '../common/docker-compose/converter';

export abstract class InitCommand extends Command {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file';

  static flags = {
    ...Command.flags,
    component_file: Flags.string({
      description: `${Command.DEPRECATED} Please use --component-file.`,
      hidden: true,
    }),
    'component-file': Flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
    }),
    name: Flags.string({
      char: 'n',
    }),
    from_compose: Flags.string({
      description: `${Command.DEPRECATED} Please use --from-compose.`,
      hidden: true,
    }),
    'from-compose': Flags.string({}),
  };

  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['component-file'] = flags.component_file ? flags.component_file : flags['component-file'];
    flags['from-compose'] = flags.from_compose ? flags.from_compose : flags['from-compose'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { flags } = await this.parse(InitCommand);

    const from_path = await this.getComposeFromPath(flags);
    const docker_compose = DockerComposeUtils.loadDockerCompose(from_path);

    const answers: any = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What should the name of the component be?',
        when: !flags.name,
        filter: value => value.toLowerCase(),
        validate: (value: any) => {
          if ((new RegExp('^[a-z][a-z-]+[a-z]$').test(value))) {
            return true;
          }
          return `Component name can only contain lowercase letters and dashes, and must start and end with a letter.`;
        },
      },
    ]);

    const { architect_yml, warnings } = ComposeConverter.convert(docker_compose, `${flags.name || answers.name}`);
    for (const warning of warnings) {
      this.log(chalk.yellow(warning));
    }

    try {
      validateOrRejectSpec(yaml.load(architect_yml));
    } catch (err: any) {
      this.error(chalk.red(`${err}\nYour docker compose file at ${from_path} was unable to be converted to an Architect component. If you think this is a bug, please submit an issue at https://github.com/architect-team/architect-cli/issues.`));
    }

    fs.writeFileSync(flags['component-file'], architect_yml);
    this.log(chalk.green(`Converted ${path.basename(from_path)} and wrote Architect component config to ${flags['component-file']}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://www.architect.io/docs/reference/component-spec.'));
  }

  async getComposeFromPath(flags: any): Promise<string> {
    let from_path;
    if (flags['from-compose']) {
      from_path = path.resolve(untildify(flags['from-compose']));
    } else {
      const files_in_current_dir = fs.readdirSync('.');
      const default_compose = files_in_current_dir.find(f => f.includes('compose') && (f.endsWith('.yml') || f.endsWith('.yaml')));

      if (default_compose) {
        from_path = default_compose;
        if (!fs.existsSync(from_path) || !fs.statSync(from_path).isFile()) {
          throw new Error(`The Docker Compose file ${from_path} couldn't be found.`);
        }
      } else {
        const answers: any = await inquirer.prompt([
          {
            type: 'input',
            name: 'from_compose',
            message: 'What is the filename of the Docker Compose file you would like to convert?',
            validate: (value: any) => {
              return fs.existsSync(value) && fs.statSync(value).isFile() ? true : `The Docker Compose file ${value} couldn't be found.`;
            },
          },
        ]);
        from_path = path.resolve(untildify(answers.from_compose));
      }
    }
    return from_path;
  }
}
