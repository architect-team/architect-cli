import {flags} from '@oclif/command';
import inquirer from 'inquirer';
import chalk from 'chalk';
import Command from '../../base-command';

export default class EnvironmentDestroy extends Command {
  static aliases = ['environment:destroy', 'envs:destroy', 'env:destroy'];
  static description = 'Destroy an environment';

  static flags = {
    ...Command.flags,
    auto_approve: flags.boolean({
      description: 'Automatically apply the changes without reviewing the diff',
      char: 'a',
      default: false,
    }),
    force: flags.boolean({
      description: 'Force the deletion even if the environment is not empty',
      char: 'f',
      default: false,
    }),
  };

  static args = [{
    name: 'name',
    description: 'Name of the environment to destroy',
    required: true,
  }];

  async run() {
    const {args, flags} = this.parse(EnvironmentDestroy);

    let answers: any = await inquirer.prompt([
      {
        type: 'autocomplete',
        name: 'environment',
        message: 'Select environment:',
        source: async (_: any, input: string) => {
          const params = { q: input };
          const { data: environments } = await this.app.api.get('/environments', { params });
          return environments.map((environment: any) => environment.name);
        },
        when: !args.environment,
      },
      {
        type: 'input',
        name: 'destroy',
        message: 'Are you absolutely sure? This will destroy the environment.\nPlease type in the name of the environment to confirm.\n',
        validate: (value, answers: any) => {
          const environment = args.environment || answers.environment;
          if (value === environment) {
            return true;
          }
          return `Name must match: ${chalk.blue(environment)}`;
        },
        when: !flags.auto_approve,
      },
    ]);

    answers = { ...args, ...flags, ...answers };
    await this.app.api.delete(`/environments/${answers.environment}`, {
      params: {
        force: answers.force ? 1 : 0,
      },
    });
    this.log(chalk.green('Environment destroy'));
  }
}
