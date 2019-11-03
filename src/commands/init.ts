import {flags} from '@oclif/command';
import path from 'path';
import fs from 'fs';
import inquirer from 'inquirer';
import {plainToClass} from 'class-transformer';
import ServiceConfig from '../common/service-config';
import ARCHITECTPATHS from '../paths';
import Command from '../base-command';

declare const process: NodeJS.Process;

export default class Init extends Command {
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

  private async promptQuestions(): Promise<ServiceConfig> {
    const { args, flags } = this.parse(Init);

    let answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        default: args.name,
        filter: value => value.toLowerCase(),
        validate: (val: string) => {
          const parts = val.split('/');
          if (parts.length < 2) {
            return `Service names must include a namespace citing the account owner (e.g. my-org/${val})`;
          } else if (parts.length > 2) {
            return 'Service names can only include one "/" to split the name from the namespace';
          }

          return true;
        },
      },
      {
        type: 'input',
        name: 'description',
        default: flags.description,
        when: !flags.description,
      },
      {
        type: 'input',
        name: 'keywords',
        message: 'keywords (comma-separated)',
        default: flags.keywords,
        filter: input => input.split(',').map((s: string) => s.trim()),
        when: !flags.keywords,
      },
      {
        type: 'input',
        name: 'language',
        default: flags.language,
        when: !flags.language,
      },
    ]);

    answers = {
      ...answers,
      ...flags,
    };

    return plainToClass(ServiceConfig, answers);
  }

  async run() {
    const { flags } = this.parse(Init);

    const config = await this.promptQuestions();

    let savePath = process.cwd();
    if (flags.output) {
      savePath = path.resolve(flags.output);
    }
    savePath = path.join(savePath, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    const configJson = JSON.stringify(config, null, 2);
    fs.writeFileSync(savePath, configJson);

    this.log(`Service configuration created successfully:`);
    this.log(configJson);
  }
}
