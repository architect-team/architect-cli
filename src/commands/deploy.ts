import { CliUx, Flags, Interfaces } from '@oclif/core';
import chalk from 'chalk';
import fs from 'fs';
import inquirer from 'inquirer';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils, GetEnvironmentOptions } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import BaseCommand from '../base-command';
import DeployUtils from '../common/utils/deploy.utils';
import { booleanString } from '../common/utils/oclif';
import { buildSpecFromPath } from '../dependency-manager/spec/utils/component-builder';
import { ComponentVersionSlugUtils } from '../dependency-manager/spec/utils/slugs';
import Dev from './dev';
import ComponentRegister from './register';

export abstract class DeployCommand extends BaseCommand {
  static flags = {
    ...BaseCommand.flags,
    auto_approve: booleanString({
      exclusive: ['compose-file', 'compose_file'],
      description: `Please use --auto-approve.`,
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: {
        to: 'auto-approve',
      },
    }),
    'auto-approve': booleanString({
      exclusive: ['compose-file', 'compose_file'],
      description: 'Automatically approve the deployment without a review step. Used for debugging and CI flows.',
      sensitive: false,
      default: false,
    }),
  };

  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
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
      const confirmation = await inquirer.prompt([{
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to apply?',
        ciMessage: '--auto-approve flag is required in CI pipelines',
      }]);
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

  static examples = [
    'architect deploy mycomponent:latest',
    'architect deploy ./myfolder/architect.yml --secret-file=./mysecrets.yml --environment=myenvironment --account=myaccount --auto-approve',
  ];

  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,
    local: booleanString({
      char: 'l',
      description: `Deploy the stack locally instead of via Architect Cloud`,
      exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
      sensitive: false,
      default: undefined,
      deprecated: true,
    }),
    production: booleanString({
      description: `Please use --environment.`,
      dependsOn: ['local'],
      sensitive: false,
      default: undefined,
      deprecated: {
        to: 'environment',
      },
    }),
    compose_file: Flags.string({
      description: `Please use --compose-file.`,
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
      sensitive: false,
      deprecated: {
        to: 'compose-file',
      },
    }),
    'compose-file': Flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      sensitive: false,
    }),
    detached: booleanString({
      description: 'Run in detached mode',
      char: 'd',
      dependsOn: ['local'],
      sensitive: false,
      default: undefined,
    }),
    parameter: Flags.string({
      char: 'p',
      description: `Please use --secret.`,
      multiple: true,
      hidden: true,
      deprecated: {
        to: 'secret',
      },
    }),
    interface: Flags.string({
      char: 'i',
      description: 'Deprecated: Please use ingress.subdomain https://docs.architect.io/components/ingress-rules/',
      multiple: true,
      default: undefined,
      sensitive: false,
      deprecated: true,
      hidden: true,
    }),
    'secret-file': Flags.string({
      description: 'Path of secrets file',
      multiple: true,
      default: [],
    }),
    secrets: Flags.string({
      description: `Please use --secret-file.`,
      multiple: true,
      hidden: true,
      deprecated: {
        to: 'secret-file',
      },
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
      description: `Please use --secret-file.`,
      deprecated: {
        to: 'secret-file',
      },
    }),
    'deletion-protection': booleanString({
      default: true,
      description: '[default: true] Toggle for deletion protection on deployments',
      exclusive: ['local'],
      sensitive: false,
    }),
    recursive: booleanString({
      char: 'r',
      default: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
      sensitive: false,
    }),
    refresh: booleanString({
      default: true,
      hidden: true,
      exclusive: ['local', 'compose-file', 'compose_file'],
      sensitive: false,
    }),
    browser: booleanString({
      default: true,
      description: '[default: true] Automatically open urls in the browser for local deployments',
      sensitive: false,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    if (parsed.argv.length > 0) {
      parsed.args.configs_or_components = parsed.argv;
    } else {
      parsed.args.configs_or_components = ['./architect.yml'];
    }
    parsed.flags = DeployUtils.parseFlags(parsed.flags);
    return parsed;
  }

  protected async runRemote(): Promise<void> {
    const { args, flags } = await this.parse(Deploy);

    const components = args.configs_or_components;

    const interfaces_map = DeployUtils.getInterfacesMap(flags.interface || []);
    const all_secret_file_values = [...(flags['secret-file'] || []), ...(flags.secrets || [])]; // TODO: 404: remove
    const component_secrets = DeployUtils.getComponentSecrets(flags.secret, all_secret_file_values); // TODO: 404: update
    const component_parameters = DeployUtils.getComponentSecrets(flags.parameter || [], all_secret_file_values); // TODO: 404: remove
    const all_secrets = { ...component_parameters, ...component_secrets }; // TODO: 404: remove

    const account = await AccountUtils.getAccount(this.app, flags.account);
    const get_environment_options: GetEnvironmentOptions = { environment_name: flags.environment };
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, get_environment_options);

    const component_names: Set<string> = new Set<string>();
    for (const component of components) {
      if (fs.existsSync(component)) {
        const register = new ComponentRegister([component, '-a', account.name, '-e', environment.name], this.config);
        register.app = this.app;
        await register.run();
        const component_spec = buildSpecFromPath(component);
        component_names.add(`${component_spec.name}:${ComponentRegister.getTagFromFlags({ environment: environment.name })}`); // component_spec.name can be either account-name/component-name or just component-name
      } else if (ComponentVersionSlugUtils.Validator.test(component)) {
        component_names.add(component);
      } else {
        throw new Error(`${component} isn't either the name of a component or a path to an existing component file.`);
      }
    }

    const deployment_dtos = [];
    for (const component of component_names) {
      const deploy_dto = {
        component,
        interfaces: interfaces_map,
        recursive: flags.recursive,
        values: all_secrets, // TODO: 404: update
        prevent_destroy: flags['deletion-protection'],
      };
      deployment_dtos.push(deploy_dto);
    }

    CliUx.ux.action.start(chalk.blue(`Creating pipeline${deployment_dtos.length > 0 ? 's' : ''}`));
    const pipelines = await Promise.all(
      deployment_dtos.map(async (deployment_dto) => {
        const { data: pipeline } = await this.app.api.post(`/environments/${environment.id}/deploy`, deployment_dto);
        return { component_name: deployment_dto.component, pipeline };
      }),
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
          });
      }),
    );
    CliUx.ux.action.stop();

    // Get available URLs from CertManager data
    const { data: cert_data } = await this.app.api.get(`/environments/${environment.id}/certificates`);
    const available_urls: Set<string> = new Set<string>();

    for (const data of cert_data) {
      const cert_component_name = data.metadata.labels['architect.io/component'];
      const deployed_component_name_with_tag = `${cert_component_name}:${data.metadata.labels['architect.io/component-tag']}`;
      const label_set = new Set<string>([deployed_component_name_with_tag, cert_component_name]);
      if ((new Set([...component_names].filter(n => label_set.has(n)))).size > 0) {
        for (const dns_name of data.spec.dnsNames) {
          if (!dns_name.startsWith('env--')) {
            available_urls.add(`https://${dns_name}`);
          }
        }
      }
    }

    if (available_urls) {
      this.log('Deployed services are now available at the following URLs:\n');
      for (const url of available_urls) {
        this.log(`\t${url}`);
      }
    }
  }

  async run(): Promise<void> {
    const { args, flags } = await this.parse(Deploy);

    if (args.configs_or_components.length > 1 && flags.interface?.length) {
      throw new Error('Interface flag not supported if deploying multiple components in the same command.');
    }

    if (flags.local) {
      this.log(chalk.yellow('The --local(-l) flag will be deprecated soon. Please switch over to using the architect dev command instead.'));
      this.log(chalk.yellow('All deprecated flags will also be removed.'));
      await new Promise(resolve => setTimeout(resolve, 2000));
      await Dev.run();
    } else {
      await this.runRemote();
    }
  }
}
