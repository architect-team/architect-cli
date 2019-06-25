import { flags } from '@oclif/command';
import chalk from 'chalk';
import inquirer from 'inquirer';
import Listr from 'listr';

import Command from '../../base';

const _info = chalk.blue;

export default class DeleteEnvironment extends Command {
  static description = 'Delete environment';
  static aliases = ['envs:delete'];

  static args = [
    { name: 'environment', description: 'Environment name' }
  ];

  static flags = {
    help: flags.help({ char: 'h' }),
  };

  async run() {
    const answers = await this.promptOptions();
    const tasks = new Listr([
      {
        title: `Deleting environment ${_info(answers.environment)}`,
        task: async () => {
          return this.architect.delete(`/environments/${answers.environment}`);
        }
      },
    ]);

    await tasks.run();
  }

  async promptOptions() {
    const { args } = this.parse(DeleteEnvironment);

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
      name: 'delete',
      message: 'Are you absolutely sure?\nThis will delete the environment.\nPlease type in the name of the environment to confirm.\n',
      validate: (value, answers) => {
        const environment = args.environment || answers!.environment;
        if (value === environment) {
          return true;
        }
        return `Name must match: ${_info(environment)}`;
      }
    }]);
    return { ...args, ...answers };
  }
}
