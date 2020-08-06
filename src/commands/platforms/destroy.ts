import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base-command';
import { AccountUtils } from '../../common/utils/account';
import { PlatformUtils } from '../../common/utils/platform';

export default class PlatformDestroy extends Command {
  static aliases = ['platform:destroy', 'platforms:destroy'];
  static description = 'Destroy a platform';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    auto_approve: flags.boolean({
      description: 'Automatically apply the changes',
      default: false,
    }),
  };

  static args = [{
    name: 'platform',
    description: 'Name of the platform to destroy',
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(PlatformDestroy);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const platform = await PlatformUtils.getPlatform(this.app.api, account, args.platform);

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will destroy the platform.\nPlease type in the name of the platform to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === platform.name) {
          return true;
        }
        return `Name must match: ${chalk.blue(platform.name)}`;
      },
      when: !flags.auto_approve,
    }]);

    answers = { ...args, ...flags, ...answers };
    const { data: account_platform } = await this.app.api.get(`/accounts/${account.id}/platforms/${platform.name}`);

    cli.action.start(chalk.blue('Destroying platform'));
    await this.app.api.delete(`/platforms/${account_platform.id}`);
    cli.action.stop();
    this.log(chalk.green('Platform destroyed'));
  }
}
