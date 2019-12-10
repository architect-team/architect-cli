import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
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
    name: 'environment',
    description: 'Name of the environment to destroy',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }, {
    name: 'account_name',
    description: 'Account that the environment belongs to',
    required: false
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentDestroy);

    let fetched_account: any;
    let answers: any = await inquirer.prompt([{
      type: 'input',
      name: 'account_name',
      message: 'What account does the environment belong to?',
      when: !args.account_name,
      validate: async (value: any, answers: any) => {
        if (!value) {
          return 'You must select an account';
        }
        try {
          fetched_account = (await this.app.api.get(`/accounts/${value}`)).data;
          if (fetched_account) {
            return true;
          }
        } catch (err) {
          return `You do not have access to the account: ${chalk.blue(value)}`;
        }
      },
    }]);

    if (!fetched_account) {
      const selected_account_name = answers.account_name || args.account_name;
      try {
        fetched_account = (await this.app.api.get(`/accounts/${selected_account_name}`)).data;
      } catch (err) {
        throw new Error(`You do not have access to the account ${selected_account_name}`);
      }
    }
    answers = Object.assign({}, answers, await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will destroy the environment.\nPlease type in the name of the environment to confirm.\n',
      validate: (value: any, answers: any) => {
        const environment = args.environment || answers.environment;
        if (value === environment) {
          answers.environment = environment;
          return true;
        }
        return `Name must match: ${chalk.blue(environment)}`;
      },
      when: !flags.auto_approve,
    }]));

    cli.action.start(chalk.green('Destroying environment'));
    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${fetched_account.id}/environments/${answers.environment}`);
    await this.app.api.delete(`/environments/${account_environment.id}`, {
      params: {
        force: answers.force ? 1 : 0,
      },
    });
    cli.action.stop(chalk.green('Environment destroyed'));
  }
}
