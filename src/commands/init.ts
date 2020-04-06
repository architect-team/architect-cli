import { flags } from '@oclif/command';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import Command from '../base-command';
import { ServiceConfig, ServiceConfigBuilder } from '../dependency-manager/src';
import ARCHITECTPATHS from '../paths';

declare const process: NodeJS.Process;

export default class Init extends Command {
  auth_required() {
    return false;
  }

  static description = 'Generate an Architect service configuration file';

  static examples = [
    `$ architect hello
? name: architect/test-service
? description: Test service
? keywords (comma-separated): test,microservice
? author: architect`,
  ];

  static flags = {
    ...Command.flags,
    description: flags.string({
      char: 'd',
      description: 'Written description of the service and its function',
    }),
    keywords: flags.string({
      char: 'k',
      description: 'Comma-separated list of keywords used to discover the service',
    }),
    language: flags.string({
      char: 'l',
      description: 'The language the service is written in',
    }),
    output: flags.string({
      char: 'o',
      description: 'Directory to write config file to',
    }),
  };

  static args = [{
    name: 'name',
    char: 'n',
    default: path.basename(process.cwd()),
    parse: (value: string) => value.toLowerCase(),
  }];

  private async promptDependencies(inputs: any = []): Promise<any> {
    const prompts = [
      {
        type: 'input',
        name: 'dependency_name_or_path',
        message: 'Please provide the name of or file path to a dependent service',
        validate: (value: string) => {
          const file_path = path.join(value, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
          if (fs.existsSync(file_path)) {
            return true;
          }
          const [service_account, service_name] = value.split('/');
          if (service_account && service_name.split(':').length === 2) {
            return true;
          }
          return 'Must be a path to an architect.json file or a service name of the form account/name:tag';
        },
      },
      {
        type: 'input',
        name: 'dependency_address_var',
        message: 'What environment parameter should be enriched with the location of this dependency?',
        validate: (value: string) => {
          const match = value.match(/[A-Z|0-9|_]+/g);
          if (!match || match.length !== 1 || match[0] !== value) {
            return 'Variable must contain only uppercase letters, numbers, and underscores';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'add_another',
        message: 'Any more dependencies?',
        default: true,
      },
    ];

    const { add_another, ...answers } = await inquirer.prompt(prompts);
    const newInputs = [...inputs, answers];
    return add_another ? this.promptDependencies(newInputs) : newInputs;
  }

  private async promptVariables(inputs: any = []): Promise<any> {
    const prompts = [
      {
        type: 'input',
        name: 'var_name',
        message: 'What is the name of this parameter?',
        validate: (value: string) => {
          const match = value.match(/[A-Z|0-9|_]+/g);
          if (!match || match.length !== 1 || match[0] !== value) {
            return 'Variable must contain only uppercase letters, numbers, and underscores';
          }
          return true;
        },
      },
      {
        type: 'confirm',
        name: 'var_required',
        message: 'Is this parameter required?',
      },
      {
        type: 'input',
        name: 'var_default',
        message: 'What is the default value of this parameter (if any)?',
      },
      {
        type: 'confirm',
        name: 'add_another',
        message: 'Any more parameters?',
        default: true,
      },
    ];

    const { add_another, ...answers } = await inquirer.prompt(prompts);
    const newInputs = [...inputs, answers];
    return add_another ? this.promptVariables(newInputs) : newInputs;
  }

  private async promptQuestions(): Promise<ServiceConfig> {
    const { flags } = this.parse(Init);

    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'Name of service (account/name)',
        filter: value => value.toLowerCase(),
        validate: (val: string) => {
          const parts = val.split('/');
          if (parts.length < 2) {
            return `Service names must include a namespace citing the account (e.g. my-org/${val} or my-account-name/${val})`;
          } else if (parts.length > 2) {
            return 'Service names can only include one "/" to split the name from the namespace';
          }
          return true;
        },
      },
    ]);

    const has_dependencies = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'has_dependencies',
        message: 'Does your service connect to any dependencies?',
      },
    ]);

    let dependency_answers = [];
    if (has_dependencies.has_dependencies) {
      dependency_answers = await this.promptDependencies([]);
    }

    const has_variables = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'has_variables',
        message: 'Does your service expose any configurable parameters?',
      },
    ]);

    let variable_answers = [];
    if (has_variables.has_variables) {
      variable_answers = await this.promptVariables([]);
    }

    const docker_command_answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'dockerfile',
        message: 'When running locally, what Dockerfile does this use service use (leave blank to use default)?',
        filter: value => value || undefined,
      },
      {
        type: 'input',
        name: 'command',
        message: 'When running locally, what command should be used to start the service (leave blank to use default docker CMD)?',
        filter: value => value || undefined,
      },
    ]);

    const config: any = {
      name: answers.name,
      dockerfile: docker_command_answers.dockerfile,
      command: docker_command_answers.command,
      ...flags,
    };
    if (dependency_answers.length) {
      const dependency_dict = dependency_answers.reduce((acc: any, val: any) => {
        let service_name;
        let service_tag;
        const file_path = path.join(val.dependency_name_or_path, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
        if (fs.existsSync(file_path)) {
          const architect_json = fs.readJSONSync(file_path);
          service_name = architect_json.name;
          service_tag = 'latest';
        } else {
          const [name, tag] = val.dependency_name_or_path.split(':');
          service_name = name;
          service_tag = tag;
        }
        acc[service_name] = service_tag;

        variable_answers.push({
          var_name: val.dependency_address_var,
          var_default: {
            valueFrom: {
              value: '$HOST:$PORT',
              dependency: `${service_name}:${service_tag}`,
            },
          },
        });

        return acc;
      }, {});
      config.dependencies = dependency_dict;
    }

    if (variable_answers.length) {
      const var_dict = variable_answers.reduce((acc: any, val: any) => {
        acc[val.var_name] = {
          required: val.var_required,
          default: val.var_default || undefined,
        };
        return acc;
      }, {});
      config.parameters = var_dict;
    }

    return ServiceConfigBuilder.buildFromJSON(config);
  }

  async run() {
    const { flags } = this.parse(Init);

    const config = await this.promptQuestions();

    let savePath = flags.output ? path.resolve(flags.output) : process.cwd();
    savePath = path.join(savePath, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    delete config.__version;
    const configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync(savePath, configJson);
    this.log(chalk.green('Success! A manifest for this service has been added at `architect.json`.'));
  }
}
