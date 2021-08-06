import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base-command';
import { AccountUtils } from '../../common/utils/account';
import { PlatformUtils } from '../../common/utils/platform';

export default class PlatformDestroy extends Command {
  static aliases = ['platforms:deregister', 'platform:destroy', 'platforms:destroy'];
  static description = 'Deregister a platform from Architect';

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
  };

  static args = [{
    name: 'platform',
    description: 'Name of the platform to deregister',
    parse: (value: string) => value.toLowerCase(),
  }];

  parse(options: any, argv = this.argv): any {
    const parsed = super.parse(options, argv);
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run() {
    const { args, flags } = this.parse(PlatformDestroy);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const platform = await PlatformUtils.getPlatform(this.app.api, account, args.platform);

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will deregister the platform from the Architect system.\nPlease type in the name of the platform to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === platform.name) {
          return true;
        }
        return `Name must match: ${chalk.blue(platform.name)}`;
      },
      when: !flags['auto-approve'],
    }]);

    answers = { ...args, ...flags, ...answers };
    const { data: account_platform } = await this.app.api.get(`/accounts/${account.id}/platforms/${platform.name}`);

    cli.action.start(chalk.blue('Deregistering platform'));
    await this.app.api.delete(`/platforms/${account_platform.id}`);
    cli.action.stop();
    this.log(chalk.green('Platform deregistered'));
  }
}
