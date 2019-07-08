import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import path from 'path';

import Command from '../base';
import { INIT_INTRO_TEXT } from '../common/i18n';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';
import { SemvarValidator, ServiceNameValidator } from '../common/validation-utils';

const _info = chalk.blue;
const _success = chalk.green;

export default class Init extends Command {
  static description = `Create an ${MANAGED_PATHS.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({ char: 'h' }),
    description: flags.string({
      char: 'd',
      default: '',
    }),
    version: flags.string({
      char: 'v',
      default: '0.1.0'
    }),
    keywords: flags.string({
      char: 'k',
      default: ''
    }),
    author: flags.string({
      char: 'a'
    }),
    license: flags.string({
      char: 'l',
      default: 'MIT'
    }),
    output: flags.string({
      char: 'o',
      description: 'Directory to write file to',
      hidden: true,
    })
  };

  static args = [{
    name: 'name',
    char: 'n',
    default: Init.getDefaultServiceName(),
    parse: (value: string) => value.toLowerCase()
  }];

  static getDefaultServiceName() {
    let defaultName = process.cwd();
    return defaultName.substr(
      defaultName.lastIndexOf('/') >= 0
        ? defaultName.lastIndexOf('/') + 1
        : 0
    );
  }

  async run() {
    this.log(_info(INIT_INTRO_TEXT));
    const answers: any = await this.promptOptions();

    let config = (new ServiceConfig())
      .setName(answers.name)
      .setVersion(answers.version)
      .setDescription(answers.description)
      .setKeywords(answers.keywords)
      .setAuthor(answers.author)
      .setLicense(answers.license);

    const { flags } = this.parse(Init);
    let savePath = process.cwd();
    if (flags.output) {
      savePath = path.resolve(flags.output);
    }
    ServiceConfig.writeToPath(savePath, config);
    this.log(_success(`${MANAGED_PATHS.ARCHITECT_JSON} created successfully`));
    this.log(_success(JSON.stringify(config, null, 2)));
  }

  async promptOptions() {
    const { args, flags } = this.parse(Init);

    const user = await this.architect.getUser();

    if (args.name.indexOf(user.username) !== 0) {
      args.name = `${user.username}/${args.name}`;
    }
    if (args.name && !ServiceNameValidator.test(args.name)) {
      this.error(`Name must consist of lower case alphanumeric characters, '-' or '/', and must start and end with an alphanumeric character`);
    }

    return inquirer.prompt([{
      type: 'input',
      name: 'name',
      default: args.name,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (!(value.indexOf(`${user.username}/`) === 0)) {
          return `Name must be scoped with your username: ${user.username}`;
        }
        if (!ServiceNameValidator.test(value)) {
          return `Name must consist of lower case alphanumeric characters, '-' or '/', and must start and end with an alphanumeric character`;
        }
        return true;
      }
    }, {
      type: 'input',
      name: 'version',
      default: flags.version,
      validate: value => {
        const validator = new SemvarValidator();
        if (validator.test(value)) return true;
        return 'Version numbers must use semantic versioning (semvar)';
      }
    }, {
      type: 'input',
      name: 'description',
      default: flags.description,
    }, {
      type: 'input',
      name: 'keywords',
      message: 'keywords (comma-separated):',
      default: flags.keywords,
      filter: input => input.split(',').map(string => string.trim())
    }, {
      type: 'input',
      name: 'author',
      default: flags.author || user.username,
      filter: input => [input]
    }, {
      type: 'input',
      name: 'license',
      default: flags.license
    }]);
  }
}
