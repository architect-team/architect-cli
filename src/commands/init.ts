import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';

import ManagedFiles from '../common/managed-files';
import ServiceConfig from '../common/service-config';
import {SemvarValidator} from '../common/validation-utils';

const _info = chalk.blue;
const _success = chalk.green;
const _error = chalk.red;

export default class Init extends Command {
  static description = `Create an ${ManagedFiles.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({char: 'h'}),
    name: flags.string({
      char: 'n',
      default: Init.getDefaultServiceName(),
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
  };

  static args = [];

  static getDefaultServiceName() {
    let defaultName = process.cwd();
    return defaultName.substr(
      defaultName.lastIndexOf('/') >= 0
        ? defaultName.lastIndexOf('/') + 1
        : 0
    );
  }

  async run() {
    this.printIntro();
    const answers: any = await this.promptOptions();

    let config = (new ServiceConfig())
      .setName(answers.name)
      .setVersion(answers.version)
      .setDescription(answers.description)
      .setKeywords(answers.keywords)
      .setAuthor(answers.author)
      .setLicense(answers.license);

    try {
      const savePath = path.join(process.cwd(), ManagedFiles.ARCHITECT_JSON);
      const configJSON = JSON.stringify(config, null, 2);
      fs.writeFileSync(savePath, configJSON);
      this.log(_success(`${ManagedFiles.ARCHITECT_JSON} created successfully`));
      this.log(_success(configJSON));
    } catch (error) {
      this.error(_error(`Error creating ${ManagedFiles.ARCHITECT_JSON} file`));
      this.error(_error(error));
    }

    this.exit();
  }

  printIntro() {
    this.log(_info(
      'This utility will walk you through creating an architect.json file.\n' +
      'Use `architect install <service_name>` afterwards to install a service and\n' +
      'save it as a requirement in the architect.json file.\n' +
      '\n' +
      'Press ^C at any time to quit.'
    ));
  }

  async promptOptions() {
    const {flags} = this.parse(Init);
    return inquirer.prompt([{
      type: 'input',
      name: 'name',
      message: 'name:',
      default: flags.name
    }, {
      type: 'input',
      name: 'version',
      message: 'version:',
      default: flags.version,
      validate: value => {
        const validator = new SemvarValidator();
        if (validator.test(value)) return true;
        return 'Version numbers must use semantic versioning (semvar)';
      }
    }, {
      type: 'input',
      name: 'description',
      message: 'description:'
    }, {
      type: 'input',
      name: 'keywords',
      message: 'keywords (comma-separated):',
      default: flags.keywords,
      filter: input => input.split(',').map(string => string.trim())
    }, {
      type: 'input',
      name: 'author',
      message: 'author:',
      default: flags.author || null,
      filter: input => [input]
    }, {
      type: 'input',
      name: 'license',
      message: 'license:',
      default: flags.license
    }]);
  }
}
