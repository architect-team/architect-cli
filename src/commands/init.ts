/* eslint-disable no-empty */
import { Flags } from '@oclif/core';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { validateOrRejectSpec } from '../';
import ProjectUtils from '../architect/project/project.utils';
import BaseCommand from '../base-command';
import { DockerComposeUtils } from '../common/docker-compose';
import { ComposeConverter } from '../common/docker-compose/converter';
import { ComponentSlugUtils } from '../dependency-manager/spec/utils/slugs';

export abstract class InitCommand extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file or create a project from Architect starter projects.';

  static examples = [
    'architect init',
    'architect init --name=mycomponent',
    'architect init --from-compose=mycompose.yml --component-file=architect.yml',
  ];

  static flags = {
    ...BaseCommand.flags,
    'component-file': Flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
      sensitive: false,
    }),
    'from-compose': Flags.string({
      sensitive: false,
    }),
  };

  static args = [{
    name: 'name',
    description: 'Name of your component or project',
    required: false,
  }];

  async doesDockerComposeYmlExist(): Promise<boolean> {
    const files_in_current_dir = fs.readdirSync('.');
    const default_compose = files_in_current_dir.some(f => f.includes('compose') && (f.endsWith('.yml') || f.endsWith('.yaml')));
    return default_compose;
  }

  async runProjectCreation(project_name: string): Promise<void> {
    if (fs.existsSync(`./${project_name}`)) {
      console.log(chalk.red(`The folder ./${project_name} already exists. Please choose a different project name or remove the folder`));
      return;
    }
    this.log(`Start the process to create your project '${project_name}'.`);
    const selections = await ProjectUtils.getSelections();
    await ProjectUtils.downloadGitHubRepos(selections, project_name);
    await ProjectUtils.updateArchitectYamls(this.app, selections, project_name);
    await ProjectUtils.linkSelections(this.app, selections, project_name);
    this.log(`Successfully created project ${project_name}.`);
    this.log(chalk.blue(`Now try running your project using the instructions in ${project_name}/README.md.`));
  }

  async runArchitectYamlConversion(from_path: string, component_name: string, component_file: string): Promise<void> {
    this.log(`Start the process to convert your docker compose to Architect component.`);
    const docker_compose = DockerComposeUtils.loadDockerCompose(from_path);

    const { architect_yml, warnings } = ComposeConverter.convert(docker_compose, `${component_name}`);
    for (const warning of warnings) {
      this.log(chalk.yellow(warning));
    }

    try {
      validateOrRejectSpec(yaml.load(architect_yml));
    } catch (err: any) {
      this.error(chalk.red(`${err}\nYour docker compose file at ${from_path} was unable to be converted to an Architect component. If you think this is a bug, please submit an issue at https://github.com/architect-team/architect-cli/issues.`));
    }

    fs.writeFileSync(component_file, architect_yml);
    this.log(chalk.green(`Converted ${path.basename(from_path)} and wrote Architect component config to ${component_file}`));
    this.log(chalk.blue('The component config may be incomplete and should be checked for consistency with the context of your application. Helpful reference docs can be found at https://docs.architect.io/components/architect-yml.'));
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(InitCommand);

    const compose_exist = await this.doesDockerComposeYmlExist();
    if (!args.name) {
      const answer: { chosen: any } = await inquirer.prompt([
        {
          name: 'chosen',
          message: `Please provide a name for your ${compose_exist ? 'component' : 'project'}:`,
          type: 'input',
        }]);
      args.name = answer.chosen;
    }

    if (!ComponentSlugUtils.Validator.test(args.name)) {
      if (flags['from-compose']) {
        throw new Error(`Component name can only contain lowercase letters and dashes, and must start and end with a letter.`);
      }
      throw new Error(`Project name can only contain lowercase letters and dashes, and must start and end with a letter.`);
    }

    let from_path = await this.getComposeFromPath(flags);
    if (flags['from-compose']) {
      if (!from_path) {
        throw new Error(`The Docker Compose file ${from_path} couldn't be found.`);
      }
      await this.runArchitectYamlConversion(from_path, args.name, flags['component-file']);
      return;
    }

    if (compose_exist) {
      const init_comp = await ProjectUtils.prompt(['yes', 'no'], `Would you like to convert from ${from_path}?`);
      if (init_comp === 'yes') {
        if (!from_path) {
          throw new Error(`The Docker Compose file ${from_path} couldn't be found.`);
        }
        await this.runArchitectYamlConversion(from_path, args.name, flags['component-file']);
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
        await this.runArchitectYamlConversion(from_path, args.name, flags['component-file']);
      }
      return;
    }

    await this.runProjectCreation(args.name);
  }

  async getComposeFromPath(flags: any): Promise<string | undefined> {
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
      }
    }
    return from_path;
  }
}
