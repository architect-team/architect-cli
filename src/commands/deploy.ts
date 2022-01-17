import { flags } from '@oclif/command';
import axios, { AxiosResponse } from 'axios';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import opener from 'opener';
import AccountUtils from '../architect/account/account.utils';
import { EnvironmentUtils } from '../architect/environment/environment.utils';
import PipelineUtils from '../architect/pipeline/pipeline.utils';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { DeploymentFailedError, PipelineAbortedError, PollingTimeout } from '../common/errors/pipeline-errors';
import * as Docker from '../common/utils/docker';
import { ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils } from '../dependency-manager/src';
import { buildSpecFromPath } from '../dependency-manager/src/spec/utils/component-builder';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';

export abstract class DeployCommand extends Command {

  static flags = {
    ...Command.flags,
    auto_approve: flags.boolean({
      exclusive: ['local', 'compose-file', 'compose_file'],
      description: `${Command.DEPRECATED} Please use --auto-approve.`,
      hidden: true,
    }),
    'auto-approve': flags.boolean({
      exclusive: ['local', 'compose-file', 'compose_file'],
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
    const { flags } = this.parse(Deploy);
    return !flags.local;
  }

  static description = 'Create a deploy job on Architect Cloud or run stacks locally';

  static flags = {
    ...DeployCommand.flags,
    ...AccountUtils.flags,
    ...EnvironmentUtils.flags,

    local: flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
      exclusive: ['account', 'auto-approve', 'auto_approve', 'refresh'],
    }),
    production: flags.boolean({
      description: `${Command.DEPRECATED} Please use --environment.`,
      dependsOn: ['local'],
    }),
    compose_file: flags.string({
      description: `${Command.DEPRECATED} Please use --compose-file.`,
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
      hidden: true,
    }),
    'compose-file': flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment', 'auto-approve', 'auto_approve', 'refresh'],
    }),
    detached: flags.boolean({
      description: 'Run in detached mode',
      char: 'd',
      dependsOn: ['local'],
    }),
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
      exclusive: ['local'],
    }),
    recursive: flags.boolean({
      char: 'r',
      default: true,
      allowNo: true,
      description: '[default: true] Toggle to automatically deploy all dependencies',
    }),
    refresh: flags.boolean({
      default: true,
      hidden: true,
      allowNo: true,
      exclusive: ['local', 'compose-file', 'compose_file'],
    }),
    browser: flags.boolean({
      default: true,
      allowNo: true,
      description: '[default: true] Automatically open urls in the browser for local deployments',
    }),
    build_parallel: flags.boolean({
      description: `${Command.DEPRECATED} Please use --build-parallel.`,
      hidden: true,
    }),
    'build-parallel': flags.boolean({
      default: false,
      description: '[default: false] Build docker images in parallel',
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

    // Merge any values set via deprecated flags into their supported counterparts
    const flags: any = parsed.flags;
    flags['build-parallel'] = flags.build_parallel ? flags.build_parallel : flags['build-parallel'];
    flags['compose-file'] = flags.compose_file ? flags.compose_file : flags['compose-file'];
    flags['secrets'] = flags.values ? flags.values : flags['secrets'];

    // If values were provided and secrets were not provided, override the secrets with the values
    if (!flags.secrets && fs.existsSync('./values.yml')) {
      flags.secrets = './values.yml';
    } else if (!flags.secrets && fs.existsSync('./secrets.yml')) {
      flags.secrets = './secrets.yml';
    }

    parsed.flags = flags;

    return parsed;
  }

  async runCompose(compose: DockerComposeTemplate): Promise<void> {
    const { flags } = this.parse(Deploy);

    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags['compose-file'] || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.dump(compose));
    this.log(`Wrote docker-compose file to: ${compose_file}`);

    if (flags['build-parallel']) {
      await execa('docker-compose', ['-f', compose_file, '-p', project_name, 'build', '--parallel'], { stdio: 'inherit' });
    } else {
      await execa('docker-compose', ['-f', compose_file, '-p', project_name, 'build'], { stdio: 'inherit' });
    }

    console.clear();

    this.log('Building containers...', chalk.green('done'));
    this.log('');

    this.log('Once the containers are running they will be accessible via the following urls:');

    const exposed_interfaces: string[] = [];
    const gateway = compose.services['gateway'];
    if (gateway?.ports?.length && typeof gateway.ports[0] === 'string') {
      const gateway_port = gateway.ports[0].split(':')[0];
      for (const [service_name, service] of Object.entries(compose.services)) {
        if (service.labels?.includes('traefik.enable=true')) {
          const host_rules = service.labels.filter(label => label.includes('rule=Host'));
          for (const host_rule of host_rules) {
            const host = new RegExp(/Host\(`(.*?)`\)/g);
            const host_match = host.exec(host_rule);
            if (host_match) {
              this.log(`${chalk.blue(`http://${host_match[1]}:${gateway_port}/`)} => ${service_name}`);
              exposed_interfaces.push(`http://${host_match[1]}:${gateway_port}/`);
            }
          }
        }
      }
      this.log('');
    }

    for (const svc_name of Object.keys(compose.services)) {
      for (const port_pair of compose.services[svc_name].ports || []) {
        const [exposed_port, internal_port] = port_pair && (port_pair as string).split(':');
        this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}:${internal_port}`);
      }
    }
    this.log('');
    this.log('Starting containers...');
    this.log('');

    if (!isCi && flags.browser) {
      let open_browser_attempts = 0;
      const poll_interval = 2000;
      const browser_interval = setInterval(async () => {
        if (open_browser_attempts === 150) {
          clearInterval(browser_interval);
          return;
        }

        const promises: Promise<AxiosResponse<any>>[] = [];
        for (const exposed_interface of exposed_interfaces) {
          const [host_name, port] = exposed_interface.replace('http://', '').split(':');
          promises.push(axios.get(`http://localhost:${port}`, {
            headers: {
              Host: host_name,
            },
            maxRedirects: 0,
            timeout: poll_interval,
            validateStatus: (status: number) => { return status < 500 && status !== 404; },
          }));
        }

        Promise.all(promises).then(() => {
          for (const exposed_interface of exposed_interfaces) {
            this.log('Opening', chalk.blue(exposed_interface));
            opener(exposed_interface);
          }
          this.log('(disable with --no-browser)');
          clearInterval(browser_interval);
        }).catch(err => {
          // at least one exposed service is not yet ready
        });
        open_browser_attempts++;
      }, poll_interval);
    }

    const compose_args = ['-f', compose_file, '-p', project_name, 'up', '--timeout', '0'];
    if (flags.detached) {
      compose_args.push('-d');
    }

    const cmd = execa('docker-compose', compose_args);
    cmd.stdin?.pipe(process.stdin);
    cmd.stdout?.pipe(process.stdout);
    cmd.stderr?.pipe(process.stderr);

    process.on('SIGINT', () => {
      this.log('Interrupt received.');
      this.warn('Please wait for architect to exit or containers will still be running in the background.');
      this.log('Gracefully shutting down...');
      execa.sync('docker-compose', ['-f', compose_file, '-p', project_name, 'stop', '--timeout', '0'], { stdio: 'inherit' });
      this.log('Stopping operation...');
      process.exit(0);
    });

    await cmd;
  }

  private readSecretsFile(secrets_file_path: string | undefined) {
    let component_secrets: any = {};
    if (secrets_file_path && fs.statSync(secrets_file_path)) {
      const secrets_file_data = fs.readFileSync(secrets_file_path);
      component_secrets = yaml.load(secrets_file_data.toString('utf-8'));
    }
    return component_secrets;
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

  private getComponentSecrets() {
    const { flags } = this.parse(Deploy);
    const component_secrets = this.readSecretsFile(flags.secrets);
    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    if (extra_params && Object.keys(extra_params).length) {
      if (!component_secrets['*']) {
        component_secrets['*'] = {};
      }
      component_secrets['*'] = { ...component_secrets['*'], ...extra_params };
    }
    return component_secrets;
  }

  private getInterfacesMap() {
    const { flags } = this.parse(Deploy);
    const interfaces_map: Dictionary<string> = {};
    for (const i of flags.interface) {
      const [key, value] = i.split(':');
      interfaces_map[key] = value || key;
    }
    return interfaces_map;
  }

  private async runLocal() {
    const { args, flags } = this.parse(Deploy);
    await Docker.verify();

    if (!args.configs_or_components || !args.configs_or_components.length) {
      args.configs_or_components = ['./architect.yml'];
    }

    const interfaces_map = this.getInterfacesMap();
    const component_secrets = this.getComponentSecrets();

    const linked_components = this.app.linkedComponents;
    const component_versions: string[] = [];
    for (const config_or_component of args.configs_or_components) {

      let component_version = config_or_component;
      if (!ComponentVersionSlugUtils.Validator.test(config_or_component) && !ComponentSlugUtils.Validator.test(config_or_component)) {
        const res = buildSpecFromPath(config_or_component);
        linked_components[res.name] = config_or_component;
        component_version = res.name;
      }
      component_versions.push(component_version);
    }

    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      linked_components,
    );
    if (flags.environment) {
      dependency_manager.environment = flags.environment;
    } else if (flags.production) {
      dependency_manager.environment = 'local-production';
    }

    const component_specs: ComponentSpec[] = [];

    // Check if multiple instances of the same component are being deployed. This check is needed
    // so that we can disable automatic interface mapping since we can't map a single interface to
    // multiple components at this time
    const onlyUnique = <T>(value: T, index: number, self: T[]) => self.indexOf(value) === index;
    const uniqe_names = component_versions.map(name => name.split('@')[0]).filter(onlyUnique);
    const duplicates = uniqe_names.length !== component_versions.length;

    const component_options = { map_all_interfaces: !flags.production && !duplicates };

    for (const component_version of component_versions) {
      const component_config = await dependency_manager.loadComponentSpec(component_version, interfaces_map, component_options);

      if (flags.recursive) {
        const dependency_configs = await dependency_manager.loadComponentSpecs(component_config);
        component_specs.push(...dependency_configs);
      } else {
        component_specs.push(component_config);
      }
    }
    const graph = await dependency_manager.getGraph(component_specs, component_secrets);
    const compose = await DockerComposeUtils.generate(graph);
    await this.runCompose(compose);
  }

  protected async runRemote(): Promise<void> {
    const { args, flags } = this.parse(Deploy);

    const components = args.configs_or_components;

    const interfaces_map = this.getInterfacesMap();
    const component_secrets = this.getComponentSecrets();

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

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }
}
