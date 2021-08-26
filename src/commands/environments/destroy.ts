import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base-command';
import { AccountUtils } from '../../common/utils/account';
import { EnvironmentUtils } from '../../common/utils/environment';

export default class EnvironmentDestroy extends Command {
  static aliases = ['environment:destroy', 'envs:destroy', 'env:destroy', 'env:deregister', 'environment:deregister'];
  static description = 'Deregister an environment';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    auto_approve: flags.boolean({
      description: `${Command.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
    }),
    ['auto-approve']: flags.boolean({
      description: 'Automatically apply the changes',
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
    description: 'Name of the environment to deregister',
    parse: (value: string): string => value.toLowerCase(),
  }];

  parse(options: any, argv = this.argv): any {
    const parsed = super.parse(options, argv);
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(EnvironmentDestroy);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
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

    cli.action.start(chalk.blue('Deregistering environment'));
    answers = { ...args, ...flags, ...answers };
    const { data: account_environment } = await this.app.api.get(`/accounts/${account.id}/environments/${environment.name}`);

    await this.app.api.delete(`/environments/${account_environment.id}`, {
      params: {
        force: answers.force ? 1 : 0,
      },
    });
    cli.action.stop();
    this.log(chalk.green('Environment deregistered'));
  }
}
