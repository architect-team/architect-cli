import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import Command from '../../base-command';
import { AccountUtils } from '../../common/utils/account';
import { PlatformUtils } from '../../common/utils/platform';

export default class EnvironmentCreate extends Command {
  static aliases = ['environment:create', 'envs:create', 'env:create'];
  static description = 'Create an environment';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    ...PlatformUtils.flags,
    description: flags.string({
      description: 'Environment Description',
    }),
  };

  static args = [{
    name: 'environment',
    description: 'Name of the environment to create',
    required: true,
    parse: (value: string) => value.toLowerCase(),
  }];

  async run() {
    const { args, flags } = this.parse(EnvironmentCreate);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const platform = await PlatformUtils.getPlatform(this.app.api, account, flags.platform);

    cli.action.start(chalk.blue('Creating environment'));

    const dto = {
      name: args.environment,
      description: flags.description,
      platform_id: platform.id,
    };
    await this.app.api.post(`/accounts/${account.id}/environments`, dto);

    const environment_url = `${this.app.config.app_host}/${account.name}/environments/${args.environment}`;
    cli.action.stop(chalk.green(`\nCreated environment: ${environment_url}`));
  }
}
