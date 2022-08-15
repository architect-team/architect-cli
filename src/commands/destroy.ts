import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import AccountUtils from '../architect/account/account.utils';
import Deployment from '../architect/deployment/deployment.entity';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import { DeployCommand } from './deploy';

export default class Destroy extends DeployCommand {
  async auth_required(): Promise<boolean> {
    return true;
  }

  static description = 'Destroy components from an environment';

  static examples = [
    'architect destroy --account=myAccount --auto-approve',
    'architect destroy --auto-approve --account=myAccount --environment=myEnvironment',
  ];

  static args = [];
  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    components: Flags.string({
      char: 'c',
      description: 'Component(s) to destroy',
      multiple: true,
      sensitive: false,
    }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Destroy);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    CliUx.ux.action.start(chalk.blue('Creating pipeline'));
    let instance_ids;
    if (flags.components) {
      const { data: instances_to_destroy } = await this.app.api.get(`/environments/${environment.id}/instances`, { params: { component_versions: flags.components } });
      instance_ids = instances_to_destroy.map((instance: Deployment) => instance.instance_id);
    }
    const { data: pipeline } = await this.app.api.delete(`/environments/${environment.id}/instances`, { data: { instance_ids } });
    CliUx.ux.action.stop();

    const approved = await this.approvePipeline(pipeline);
    if (!approved) {
      return;
    }

    CliUx.ux.action.start(chalk.blue('Deploying'));
    await PipelineUtils.pollPipeline(this.app, pipeline.id);
    this.log(chalk.green(`Deployed`));
    CliUx.ux.action.stop();
  }
}
