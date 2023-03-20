import { Flags, Interfaces } from '@oclif/core';
import { OutputFlags } from '@oclif/core/lib/interfaces';
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
import { RequiresDocker } from '../common/docker/helper';
import { RequiresGit } from '../common/utils/git/helper';
import PromptUtils from '../common/utils/prompt-utils';
import { ComponentSlugUtils } from '../dependency-manager/spec/utils/slugs';

export abstract class InitCommand extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Initialize an architect component from an existing docker-compose file or create a project from Architect starter projects.';

  static examples = [
    'architect init',
    'architect init mycomponent-or-myproject',
    'architect init --from-compose=mycompose.yml --component-file=architect.yml',
  ];

  static flags = {
    ...BaseCommand.flags,
    component_file: Flags.string({
      description: `Please use --component-file.`,
      hidden: true,
      sensitive: false,
      deprecated: {
        to: 'component-file',
      },
    }),
    'component-file': Flags.string({
      char: 'o',
      description: 'Path where the component file should be written to',
      default: 'architect.yml',
      sensitive: false,
    }),
    from_compose: Flags.string({
      description: `Please use --from-compose.`,
      hidden: true,
      sensitive: false,
      deprecated: {
        to: 'from-compose',
      },
    }),
    'from-compose': Flags.string({
      sensitive: false,
    }),
    'starter': Flags.string({
      description: 'Specify a starter project template to use as the base of your new Architect component.',
      char: 's',
      sensitive: false,
    }),
  };

  static args = [{
    name: 'name',
    description: 'Name of your project',
    required: false,
  }];

  getDefaultDockerComposeFile(): string | undefined {
    const priority_files = [
      'docker-compose.yml',
      'docker-compose.yaml',
    ];
    const files_in_current_dir = fs.readdirSync('.');
    for (const priority_file of priority_files) {
      if (files_in_current_dir.includes(priority_file)) {
        return priority_file;
      }
    }
    const default_compose = files_in_current_dir.find(f => f.includes('compose') && (f.endsWith('.yml') || f.endsWith('.yaml')));
    return default_compose;
  }

  @RequiresGit()
  @RequiresDocker({ compose: true })
  async runProjectCreation(project_name: string, flags: OutputFlags<typeof InitCommand.flags>): Promise<void> {
    if (fs.existsSync(`./${project_name}`)) {
      console.log(chalk.red(`The folder ./${project_name} already exists. Please choose a different project name or remove the folder`));
      return;
    }
    const selections = await ProjectUtils.getSelections(flags.starter);

    this.log('\n######################################');
    this.log('##### Let\'s set up your project! #####');
    this.log('######################################\n');

    await PromptUtils.oclifTimedSpinner('Creating project directory');
    await ProjectUtils.downloadGitHubRepos(selections, project_name);

    const root_path = path.join(project_name, 'architect.yml');
    this.log(chalk.green(`\nSuccessfully created project ${project_name}.\n`));
    this.log(`Your project is ready to be deployed by Architect!\nTo deploy locally, run:\n\t$ architect dev ${root_path}\n`);
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

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['component-file'] = flags.component_file ? flags.component_file : flags['component-file'];
    flags['from-compose'] = flags.from_compose ? flags.from_compose : flags['from-compose'];
    parsed.flags = flags;

    return parsed;
  }

  private isNameValid(name: string) {
    if (!name) {
      return false;
    }
    return ComponentSlugUtils.Validator.test(name);
  }

  async run(): Promise<void> {
    const { flags, args } = await this.parse(InitCommand);

    const default_compose_file = this.getDefaultDockerComposeFile();
    const invalid_name_message = 'Component name can only contain lowercase letters and dashes, and must start and end with a letter.';

    if (args.name && !this.isNameValid(args.name)) {
      this.log(chalk.yellow(`Your project name is invalid. ${invalid_name_message} Please enter a new name.`));
    }

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of your project?',
        when: !this.isNameValid(args.name),
        filter: value => value.toLowerCase(),
        validate: (value) => {
          if (this.isNameValid(value)) {
            return true;
          }
          return invalid_name_message;
        },
      },
    ]);
    args.name = args.name || answers.name;

    if (flags['from-compose']) {
      await this.runArchitectYamlConversion(path.resolve(untildify(flags['from-compose'])), args.name, flags['component-file']);
      return;
    }

    if (default_compose_file) {
      const confirmation_answers = await inquirer.prompt([{
        type: 'confirm',
        name: 'use_compose',
        message: `We detected a ${default_compose_file} file. Would you like to use it for your project?`,
      }]);
      if (confirmation_answers.use_compose) {
        await this.runArchitectYamlConversion(default_compose_file, args.name, flags['component-file']);
        return;
      }
    }

    await this.runProjectCreation(args.name, flags);
  }
}
