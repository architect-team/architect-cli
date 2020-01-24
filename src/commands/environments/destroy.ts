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
    name: 'namespaced_environment',
    description: 'Name of the environment to destroy',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentDestroy);

    const [account_name, env_name] = args.namespaced_environment.split('/');
    if (!account_name || !env_name) {
      throw new Error(`Please specify a namespaced environment in the form <account_name>/<environment_name>`);
    }

    let account = (await this.app.api.get(`/accounts/${account_name}`)).data;

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will destroy the environment.\nPlease type in the name of the environment to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === env_name) {
          return true;
        }
        return `Name must match: ${chalk.blue(env_name)}`;
      },
      when: !flags.auto_approve,
    }]);

    cli.action.start(chalk.blue('Destroying environment'));
    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${account.id}/environments/${env_name}`);

    await this.app.api.delete(`/environments/${account_environment.id}`, {
      params: {
        force: answers.force ? 1 : 0,
      },
    });
    cli.action.stop(chalk.green('Environment destroyed'));
  }
}
