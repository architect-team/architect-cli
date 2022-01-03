import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import AccountUtils from '../architect/account/account.utils';
import Deployment from '../architect/deployment/deployment.entity';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import { DeployCommand } from './deploy';

export default class Destroy extends DeployCommand {
  auth_required(): boolean {
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

  async run(): Promise<void> {
    const { flags } = this.parse(Destroy);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    cli.action.start(chalk.blue('Creating pipeline'));
    let instance_ids;
    if (flags.components) {
      const { data: instances_to_destroy } = await this.app.api.get(`/environments/${environment.id}/instances`, { params: { component_versions: flags.components } });
      instance_ids = instances_to_destroy.map((instance: Deployment) => instance.instance_id);
    }
    const { data: pipeline } = await this.app.api.delete(`/environments/${environment.id}/instances`, { data: { instance_ids } });
    cli.action.stop();

    const approved = await this.approvePipeline(pipeline);
    if (!approved) {
      return;
    }

    cli.action.start(chalk.blue('Deploying'));
    await PipelineUtils.pollPipeline(this.app, pipeline.id);
    this.log(chalk.green(`Deployed`));
    cli.action.stop();
  }
}
