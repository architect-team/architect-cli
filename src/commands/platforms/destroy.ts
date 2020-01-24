import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import Command from '../../base-command';

export default class PlatformDestroy extends Command {
  static aliases = ['platform:destroy'];
  static description = 'Destroy a platform';

  static flags = {
    ...Command.flags,
    auto_approve: flags.boolean({
      description: 'Automatically apply the changes without reviewing the diff',
      char: 'a',
      default: false,
    }),
  };

  static args = [{
    name: 'namespaced_platform',
    description: 'Name of the platform to destroy',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(PlatformDestroy);

    const [account_name, platform_name] = args.namespaced_platform.split('/');
    if (!account_name || !platform_name) {
      throw new Error(`Please specify a namespaced platform in the form <account_name>/<platform_name>`);
    }

    let account;
    try {
      account = (await this.app.api.get(`/accounts/${account_name}`)).data;
    } catch (err) {
      throw new Error(`The account ${account_name} does not exist.`);
    }

    let answers = await inquirer.prompt([{
      type: 'input',
      name: 'destroy',
      message: 'Are you absolutely sure? This will destroy the platform.\nPlease type in the name of the platform to confirm.\n',
      validate: (value: any, answers: any) => {
        if (value === platform_name) {
          return true;
        }
        return `Name must match: ${chalk.blue(platform_name)}`;
      },
      when: !flags.auto_approve,
    }]);

    answers = { ...args, ...flags, ...answers };
    const { data: account_platform } = await this.app.api.get(`/accounts/${account.id}/platforms/${platform_name}`);
    const { data: account_environments } = await this.app.api.get(`accounts/${account.id}/environments`);

    if (account_environments.rows.some((env: any) => env.platform.id === account_platform.id)) {
      throw new Error('Cannot delete a platform that still has environments');
    }

    cli.action.start(chalk.blue('Destroying platform'));
    try {
      await this.app.api.delete(`/platforms/${account_platform.id}`);
      cli.action.stop(chalk.green('Platform destroyed'));
    } catch (err) {
      if (err.response?.data?.statusCode === 403) {
        throw new Error(`You do not have permission to delete this platform.`);
      }
      throw new Error(err);
    }
  }
}
