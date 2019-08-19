import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base';
import { EnvironmentNameValidator } from '../../common/validation-utils';

const _info = chalk.blue;
const _success = chalk.green;

export default class CloneEnvironment extends Command {
  static description = 'Clone environment';
  static aliases = ['environment:clone'];

  static args = [
    { name: 'environment', description: 'Environment name', parse: (value: string) => value.toLowerCase() }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
    name: flags.string(),
    namespace: flags.string(),
  };

  async run() {
    const answers = await this.promptOptions();

    cli.action.start(`Cloning environment ${_info(answers.environment)}`);
    const data = {
      name: answers.name,
      namespace: answers.namespace
    };
    await this.architect.post(`/environments/${answers.environment}/clone`, { data });
    cli.action.stop(_success('Cloned'));
  }

  async promptOptions() {
    const { args, flags } = this.parse(CloneEnvironment);
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const answers: any = await inquirer.prompt([{
      type: 'autocomplete',
      name: 'environment',
      message: 'Select environment:',
      source: async (_: any, input: string) => {
        const params = { q: input };
        const { data: environments } = await this.architect.get('/environments', { params });
        return environments.map((environment: any) => environment.name);
      },
      when: !args.environment
    } as inquirer.Question, {
      type: 'input',
      name: 'name',
      message: 'New name',
      when: !flags.name,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Name must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      }
    }, {
      type: 'input',
      name: 'namespace',
      message: 'New namespace',
      when: !flags.namespace,
      filter: value => value.toLowerCase(),
      validate: value => {
        if (EnvironmentNameValidator.test(value)) return true;
        return `Namespace must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character`;
      },
      default: (answers: any) => answers.name
    }]);
    return { ...args, ...flags, ...answers };
  }
}
