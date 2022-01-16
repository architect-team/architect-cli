import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import inquirer from 'inquirer';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import Command from '../base-command';
import { DeploymentFailedError, PipelineAbortedError, PollingTimeout } from '../common/errors/pipeline-errors';
import DeployUtils from '../common/utils/deploy.utils';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';


export abstract class DeployCommand extends Command {

  static flags = {
    ...Command.flags,
    auto_approve: flags.boolean({
      exclusive: ['compose-file', 'compose_file'],
      description: `${Command.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
    }),
    'auto-approve': flags.boolean({
      exclusive: ['compose-file', 'compose_file'],
      description: 'Automatically approve the deployment without a review step. Used for debugging and CI flows.',
    }),
  };

  parse(options: any, argv = this.argv): any {
    const parsed = super.parse(options, argv);
    const flags: any = parsed.flags;

    // Merge any values set via deprecated flags into their supported counterparts
    flags['auto-approve'] = flags.auto_approve ? flags.auto_approve : flags['auto-approve'];
    parsed.flags = flags;

    return parsed;
  }

  async approvePipeline(pipeline: any): Promise<boolean> {
    const { flags } = this.parse(this.constructor as typeof DeployCommand);

    if (!flags['auto-approve']) {
      this.log(`Pipeline ready for review: ${this.app.config.app_host}/${pipeline.environment.account.name}/environments/${pipeline.environment.name}/pipelines/${pipeline.id}`);
      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to apply?',
      });
      if (!confirmation.deploy) {
        this.warn(`Canceled pipeline`);
        return false;
      }
    }

    await this.app.api.post(`/pipelines/${pipeline.id}/approve`);
    return true;
  }
}

export default class Deploy extends DeployCommand {
  auth_required(): boolean {
    return true;
  }

  static description = 'Create a deploy job on Architect Cloud';

  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    parameter: flags.string({
      char: 'p',
      description: 'Component parameters',
      multiple: true,
      default: [],
    }),
    interface: flags.string({
      char: 'i',
      description: 'Component interfaces',
      multiple: true,
      default: [],
    }),
    secrets: flags.string({
      char: 's',
      description: 'Path of secrets file',
    }),
    values: flags.string({
      char: 'v',
      hidden: true,
      description: `${Command.DEPRECATED} Please use --secrets.`,
    }),
    'deletion-protection': flags.boolean({
      default: true,
      allowNo: true,
      description: '[default: true] Toggle for deletion protection on deployments',
    }),
    recursive: flags.boolean({
      char: 'r',
      default: true,
      allowNo: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
    }),
  };

  static args = [{
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  parse(options: any, argv = this.argv): any {
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = super.parse(options, argv);
    parsed.args.configs_or_components = parsed.argv;

    parsed.flags = DeployUtils.parseFlags(parsed.flags);
    return parsed;
  }

  getExtraEnvironmentVariables(parameters: string[]): Dictionary<string | number | undefined> {
    const extra_env_vars: { [s: string]: string | number | undefined } = {};

    for (const [param_name, param_value] of Object.entries(process.env || {})) {
      if (param_name.startsWith('ARC_')) {
        extra_env_vars[param_name.substring(4)] = param_value;
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          const parsed = parseFloat(param_value);
          if (!isNaN(parsed)) {
            extra_env_vars[param_name.substring(4)] = parsed;
          }
          // eslint-disable-next-line no-empty
        } catch { }
      }
    }

    for (const param of parameters) {
      const param_split = param.split('=');
      if (param_split.length !== 2) {
        throw new Error(`Bad format for parameter ${param}. Please specify in the format --parameter PARAM_NAME=PARAM_VALUE`);
      }
      extra_env_vars[param_split[0]] = param_split[1];
    }

    return extra_env_vars;
  }

  protected async runRemote(): Promise<void> {
    const { args, flags } = this.parse(Deploy);

    const components = args.configs_or_components;

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface);
    const component_secrets = DeployUtils.getComponentSecrets(flags.secrets, flags.parameter);

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const deployment_dtos = [];
    for (const component of components) {
      const deploy_dto = {
        component: component,
        interfaces: interfaces_map,
        recursive: flags.recursive,
        values: component_secrets,
        prevent_destroy: flags['deletion-protection'],
      };
      deployment_dtos.push(deploy_dto);
    }

    cli.action.start(chalk.blue(`Creating pipeline${deployment_dtos.length ? 's' : ''}`));
    const pipelines = await Promise.all(
      deployment_dtos.map(async (deployment_dto) => {
        const { data: pipeline } = await this.app.api.post(`/environments/${environment.id}/deploy`, deployment_dto);
        return { component_name: deployment_dto.component, pipeline };
      })
    );
    cli.action.stop();

    const approved_pipelines = [];
    for (const pipeline of pipelines) {
      const approved = await this.approvePipeline(pipeline.pipeline);
      if (approved) {
        approved_pipelines.push(pipeline);
      }
    }

    if (!approved_pipelines?.length) {
      this.log(chalk.blue('Cancelled all pipelines'));
      return;
    }

    cli.action.start(chalk.blue('Deploying'));
    await Promise.all(
      approved_pipelines.map((pipeline) => {
        return PipelineUtils.pollPipeline(this.app, pipeline.pipeline.id)
          .then(() => {
            this.log(chalk.green(`${pipeline.component_name} Deployed`));
          })
          .catch((err) => {
            if (err instanceof PipelineAbortedError || err instanceof DeploymentFailedError || err instanceof PollingTimeout) {
              this.warn(err.message);
            } else {
              throw err;
            }
          });
      })
    );
    cli.action.stop();
  }

  async run(): Promise<void> {
    const { args, flags } = this.parse(Deploy);

    if (args.configs_or_components && args.configs_or_components.length > 1) {
      if (flags.interface?.length) {
        throw new Error('Interface flag not supported if deploying multiple components in the same command.');
      }
    }

    await this.runRemote();
  }
}
