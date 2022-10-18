import { CliUx, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../../architect/account/account.utils';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import BaseCommand from '../../base-command';
import { booleanString } from '../../common/utils/oclif';

export default class EnvironmentDestroy extends BaseCommand {
  static aliases = ['environment:destroy', 'envs:destroy', 'env:destroy', 'env:deregister', 'environment:deregister'];
  static description = 'Deregister an environment';
  static examples = [
    'architect environment:destroy --account=myaccount myenvironment',
    'architect environment:deregister --account=myaccount --auto-approve --force myenvironment',
  ];
  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    auto_approve: booleanString({
      description: `Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: {
        to: 'auto-approve',
      },
    }),
    'auto-approve': booleanString({
      description: 'Automatically apply the changes',
      default: false,
      sensitive: false,
    }),
    force: booleanString({
      description: 'Force the deletion even if the environment is not empty',
      char: 'f',
      default: false,
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'environment',
    description: 'Name of the environment to deregister',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(EnvironmentDestroy);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, args.environment);

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will deregister the environment.\nPlease type in the name of the environment to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === environment.name) {
          return true;
        }
        return `Name must match: ${chalk.blue(environment.name)}`;
      },
      when: !flags['auto-approve'],
    }]);

    CliUx.ux.action.start(chalk.blue('Deregistering environment'));
    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${account.id}/environments/${environment.name}`);

    await this.app.api.delete(`/environments/${account_environment.id}`, {
      params: {
        force: answers.force ? 1 : 0,
      },
    });
    CliUx.ux.action.stop();
    this.log(chalk.green('Environment deregistered'));
  }
}
