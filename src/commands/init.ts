import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as fs from 'fs';
import * as inquirer from 'inquirer';
import * as path from 'path';

import Command from '../base';
import { INIT_INTRO_TEXT } from '../common/i18n';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';
import { SemvarValidator } from '../common/validation-utils';

const _info = chalk.blue;
const _success = chalk.green;
const _error = chalk.red;

export default class Init extends Command {
  static description = `Create an ${MANAGED_PATHS.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({ char: 'h' }),
    name: flags.string({
      char: 'n',
      default: Init.getDefaultServiceName(),
    }),
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
    this.log(_info(INIT_INTRO_TEXT));
    const answers: any = await this.promptOptions();

    let config = (new ServiceConfig())
      .setName(answers.name)
      .setVersion(answers.version)
      .setDescription(answers.description)
      .setKeywords(answers.keywords)
      .setAuthor(answers.author)
      .setLicense(answers.license);

    try {
      const { flags } = this.parse(Init);
      const savePath = path.join(flags.output || process.cwd(), MANAGED_PATHS.ARCHITECT_JSON);
      const configJSON = JSON.stringify(config, null, 2);
      fs.writeFileSync(savePath, configJSON);
      this.log(_success(`${MANAGED_PATHS.ARCHITECT_JSON} created successfully`));
      this.log(_success(configJSON));
    } catch (error) {
      this.error(_error(`Error creating ${MANAGED_PATHS.ARCHITECT_JSON} file`));
      this.error(_error(error));
    }
  }

  async promptOptions() {
    const { flags } = this.parse(Init);
    return inquirer.prompt([{
      type: 'input',
      name: 'name',
      default: flags.name
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
      default: flags.author,
      filter: input => [input]
    }, {
      type: 'input',
      name: 'license',
      default: flags.license
    }]);
  }
}
