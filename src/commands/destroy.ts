import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import 'reflect-metadata';
import { AccountUtils } from '../common/utils/account';
import { Deployment } from '../common/utils/deployment';
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

    cli.action.start(chalk.blue('Creating pipeline'));
    let pipeline;
    if (flags.components) {
      const deployment_instances = (await this.app.api.get(`/environments/${environment.id}/instances`)).data;
      const instances_to_destroy = deployment_instances.filter((deployment: Deployment) => deployment.type === 'component' && flags.components.includes(`${deployment.component_version.config.name}:${deployment.component_version.tag}`));
      pipeline = (await this.app.api.delete(`/environments/${environment.id}/instances`, { data: { instance_ids: instances_to_destroy.map((instance: Deployment) => instance.instance_id) } })).data;
    } else {
      pipeline = (await this.app.api.delete(`/environments/${environment.id}/instances`)).data;
    }
    cli.action.stop();

    await this.approvePipeline(pipeline);
  }
}
