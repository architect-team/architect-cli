import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../../architect/account/account.utils';
import PlatformUtils from '../../architect/platform/platform.utils';
import Command from '../../base-command';

export default class PlatformDestroy extends Command {
  static aliases = ['platforms:deregister', 'platform:destroy', 'platforms:destroy'];
  static description = 'Deregister a platform from Architect';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    auto_approve: Flags.boolean({
      description: `${Command.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
    }),
    ['auto-approve']: Flags.boolean({
      description: 'Automatically apply the changes',
      default: false,
    }),
    force: Flags.boolean({
      description: 'Force the deletion even if the platform is not empty',
      char: 'f',
      default: false,
    }),
  };

  static args = [{
    name: 'platform',
    description: 'Name of the platform to deregister',
    parse: async (value: string): Promise<string> => value.toLowerCase(),
  }];

  static sensitive = new Set();

  static non_sensitive = new Set([...Object.keys({ ...this.flags }), ...this.args.map(arg => arg.name)]);

  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async run(): Promise<void> {
    try {
      const { args, flags } = await this.parse(PlatformDestroy);

      const account = await AccountUtils.getAccount(this.app, flags.account);
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

      CliUx.ux.action.start(chalk.blue('Deregistering platform'));
      const params: any = {};
      if (answers.force) {
        params.force = 1;
      }
      await this.app.api.delete(`/platforms/${account_platform.id}`, { params });
      CliUx.ux.action.stop();
      this.log(chalk.green('Platform deregistered'));
    } catch (e: any) {
      if (e instanceof Error) {
        const cli_stacktrace = Error(__filename).stack;
        if (cli_stacktrace) {
          e.stack = cli_stacktrace;
        }
      }
      throw e;
    }
  }
}
