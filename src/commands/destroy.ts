import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import 'reflect-metadata';
import { AccountUtils } from '../common/utils/account';
import { EnvironmentUtils } from '../common/utils/environment';
import { DeployCommand } from './deploy';

export default class Destroy extends DeployCommand {
  auth_required() {
    return true;
  }

  static description = 'Destroy components from an environment';

  static args = [];
  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    components: flags.string({
      char: 'c',
      description: 'Component(s) to destroy',
      multiple: true,
    }),
  };

  async run() {
    const { flags } = this.parse(Destroy);

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    if (flags.components) {
      throw new Error('Not implemented'); // TODO
    }

    cli.action.start(chalk.blue('Creating pipeline'));
    const { data: pipeline } = await this.app.api.delete(`/environments/${environment.id}/instances`);
    cli.action.stop();

    await this.approvePipeline(pipeline);
  }
}
