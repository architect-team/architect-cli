import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import BaseCommand from '../base-command';
import { DeploymentFailedError, PipelineAbortedError, PollingTimeout } from '../common/errors/pipeline-errors';
import DeployUtils from '../common/utils/deploy.utils';
import { buildSpecFromPath } from '../dependency-manager/spec/utils/component-builder';
import { ComponentSlugUtils } from '../dependency-manager/spec/utils/slugs';
import Dev from "./dev";
import ComponentRegister from './register';

export abstract class DeployCommand extends BaseCommand {
  EPHEMERAL_DELIMITER = 'architect-ephemeral';

  static flags = {
    ...BaseCommand.flags,
    auto_approve: {
      non_sensitive: true,
      ...Flags.boolean({
        exclusive: ['compose-file', 'compose_file'],
        description: `${BaseCommand.DEPRECATED} Please use --auto-approve.`,
        hidden: true,
      }),
    },
    'auto-approve': {
      non_sensitive: true,
      ...Flags.boolean({
        exclusive: ['compose-file', 'compose_file'],
        description: 'Automatically approve the deployment without a review step. Used for debugging and CI flows.',
      }),
    },
  };

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

  async approvePipeline(pipeline: any): Promise<boolean> {
    const { flags } = await this.parse(this.constructor as typeof DeployCommand);

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
  async auth_required(): Promise<boolean> {
    return true;
  }

  static description = 'Create a deploy job on Architect Cloud';

  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    local: {
      non_sensitive: true,
      ...Flags.boolean({
        char: 'l',
        description: `${BaseCommand.DEPRECATED} Deploy the stack locally instead of via Architect Cloud`,
        exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
        hidden: true,
      }),
    },
    production: {
      non_sensitive: true,
      ...Flags.boolean({
        description: `${BaseCommand.DEPRECATED} Please use --environment.`,
        dependsOn: ['local'],
      }),
    },
    compose_file: {
      non_sensitive: true,
      ...Flags.string({
        description: `${BaseCommand.DEPRECATED} Please use --compose-file.`,
        exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
        hidden: true,
      }),
    },
    'compose-file': {
      non_sensitive: true,
      ...Flags.string({
        char: 'o',
        description: 'Path where the compose file should be written to',
        default: '',
        exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      }),
    },
    detached: {
      non_sensitive: true,
      ...Flags.boolean({
        description: 'Run in detached mode',
        char: 'd',
        dependsOn: ['local'],
      }),
    },
    parameter: {
      non_sensitive: true,
      ...Flags.string({
        char: 'p',
        description: `${BaseCommand.DEPRECATED} Please use --secret.`,
        multiple: true,
        hidden: true,
      }),
    },
    interface: {
      non_sensitive: true,
      ...Flags.string({
        char: 'i',
        description: 'Component interfaces',
        multiple: true,
        default: [],
      }),
    },
    'secret-file': Flags.string({
      description: 'Path of secrets file',
      multiple: true,
      default: [],
    }),
    secrets: Flags.string({
      description: `${BaseCommand.DEPRECATED} Please use --secret-file.`,
      multiple: true,
      hidden: true,
    }),
    secret: Flags.string({
      char: 's',
      description: 'An individual secret key and value in the form SECRET_KEY=SECRET_VALUE',
      multiple: true,
      default: [],
    }),
    values: Flags.string({
      char: 'v',
      hidden: true,
      multiple: true,
      description: `${BaseCommand.DEPRECATED} Please use --secret-file.`,
    }),
    'deletion-protection': {
      non_sensitive: true,
      ...Flags.boolean({
        default: true,
        allowNo: true,
        description: '[default: true] Toggle for deletion protection on deployments',
        exclusive: ['local'],
      }),
    },
    recursive: {
      non_sensitive: true,
      ...Flags.boolean({
        char: 'r',
        default: true,
        allowNo: true,
        description: '[default: true] Toggle to automatically deploy all dependencies',
      }),
    },
    refresh: {
      non_sensitive: true,
      ...Flags.boolean({
        default: true,
        hidden: true,
        allowNo: true,
        exclusive: ['local', 'compose-file', 'compose_file'],
      }),
    },
    browser: {
      non_sensitive: true,
      ...Flags.boolean({
        default: true,
        allowNo: true,
        description: '[default: true] Automatically open urls in the browser for local deployments',
      }),
    },
  };

  static args = [{
    non_sensitive: true,
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  protected async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    parsed.args.configs_or_components = parsed.argv;
    parsed.flags = DeployUtils.parseFlags(parsed.flags);
    return parsed;
  }

  protected async runRemote(): Promise<void> {
    const { args, flags } = await this.parse(Deploy);

    const components = args.configs_or_components;

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface);
    const all_secret_file_values = flags['secret-file'].concat(flags.secrets); // TODO: 404: remove
    const component_secrets = DeployUtils.getComponentSecrets(flags.secret, all_secret_file_values); // TODO: 404: update
    const component_parameters = DeployUtils.getComponentSecrets(flags.parameter, all_secret_file_values); // TODO: 404: remove
    const all_secrets = { ...component_parameters, ...component_secrets }; // TODO: 404: remove

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const component_names: string[] = [];
    for (const component of components) {
      if (ComponentSlugUtils.Validator.test(component)) {
        component_names.push(component);
      } else {
        // TODO: catch if path/location isn't found?
        const tag = `${this.EPHEMERAL_DELIMITER}-${environment.name}`;
        const register = new ComponentRegister([component, '-a', account.name, '-e', environment.name, '-t', tag], this.config);
        register.app = this.app;
        await register.run();
        const component_spec = buildSpecFromPath(component);
        component_names.push(`${account.name}/${component_spec.name}:${tag}`);
      }
    }

    const deployment_dtos = [];
    for (const component of component_names) {
      const deploy_dto = {
        component: component,
        interfaces: interfaces_map,
        recursive: flags.recursive,
        values: all_secrets, // TODO: 404: update
        prevent_destroy: flags['deletion-protection'],
      };
      deployment_dtos.push(deploy_dto);
    }

    CliUx.ux.action.start(chalk.blue(`Creating pipeline${deployment_dtos.length ? 's' : ''}`));
    const pipelines = await Promise.all(
      deployment_dtos.map(async (deployment_dto) => {
        const { data: pipeline } = await this.app.api.post(`/environments/${environment.id}/deploy`, deployment_dto);
        return { component_name: deployment_dto.component, pipeline };
      })
    );
    CliUx.ux.action.stop();

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

    CliUx.ux.action.start(chalk.blue('Deploying'));
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
    CliUx.ux.action.stop();
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Deploy);

    if (args.configs_or_components && args.configs_or_components.length > 1) {
      if (flags.interface?.length) {
        throw new Error('Interface flag not supported if deploying multiple components in the same command.');
      }
    }

    if (flags.local) {
      this.log(chalk.yellow("The --local(-l) flag will be deprecated soon. Please switch over to using the architect dev command instead."));
      this.log(chalk.yellow("All deprecated flags will also be removed."));
      await new Promise(resolve => setTimeout(resolve, 2000));
      await Dev.run();
    } else {
      await this.runRemote();
    }
  }
}
