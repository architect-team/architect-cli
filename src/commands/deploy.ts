import { flags } from '@oclif/command';
import axios, { AxiosResponse } from 'axios';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import isCi from 'is-ci';
import yaml, { FAILSAFE_SCHEMA } from 'js-yaml';
import opener from 'opener';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { AccountUtils } from '../common/utils/account';
import * as Docker from '../common/utils/docker';
import { EnvironmentUtils } from '../common/utils/environment';
import { PipelineUtils } from '../common/utils/pipeline';
import { ComponentConfig, ComponentConfigBuilder, ComponentSlugUtils, ComponentVersionSlugUtils } from '../dependency-manager/src';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';

export abstract class DeployCommand extends Command {

  static flags = {
    ...Command.flags,
    auto_approve: flags.boolean({ exclusive: ['local', 'compose_file'] }),
    lock: flags.boolean({
      default: true,
      hidden: true,
      allowNo: true,
      exclusive: ['local', 'compose_file'],
    }),
    force_unlock: flags.integer({
      description: 'Be very careful with this flag. Usage: --force_unlock=<lock_id>.',
      hidden: true,
      exclusive: ['local', 'compose_file'],
    }),
    recursive: flags.boolean({
      char: 'r',
      default: true,
      allowNo: true,
    }),
    refresh: flags.boolean({
      default: true,
      hidden: true,
      allowNo: true,
      exclusive: ['local', 'compose_file'],
    }),
    browser: flags.boolean({
      default: true,
      allowNo: true,
    }),
    build_parallel: flags.boolean({
      default: true,
      allowNo: true,
    }),
  };

  async approvePipeline(pipeline: any) {
    const { flags } = this.parse(this.constructor as typeof DeployCommand);

    if (!flags.auto_approve) {
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
  auth_required() {
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
      exclusive: ['account', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: '',
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
    }),
    detached: flags.boolean({
      description: 'Run in detached mode',
      char: 'd',
      dependsOn: ['local'],
    }),
    build_prod: flags.boolean({
      description: 'Build without debug config',
      hidden: true,
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
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
    values: flags.string({
      char: 'v',
      description: 'Path of values file',
    }),
  };

  static args = [{
    name: 'configs_or_components',
    description: 'Path to an architect.yml file or component `account/component:latest`. Multiple components are accepted.',
  }];

  // overrides the oclif default parse to allow for configs_or_components to be a list of components
  parse(options: any, argv = this.argv): any {
    options.args = [];
    for (const arg of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = super.parse(options, argv);
    parsed.args.configs_or_components = parsed.argv;
    return parsed;
  }

  async runCompose(compose: DockerComposeTemplate) {
    const { flags } = this.parse(Deploy);

    const exposed_interfaces: string[] = [];
    const gateway = compose.services['gateway'];
    if (gateway?.ports?.length && typeof gateway.ports[0] === 'string') {
      const gateway_port = gateway.ports[0].split(':')[0];
      for (const [service_name, service] of Object.entries(compose.services)) {
        if (service.labels?.includes('traefik.enable=true')) {
          const host_rules = service.labels.filter(label => label.includes('rule=Host'));
          for (const host_rule of host_rules) {
            const host = new RegExp(/Host\(`([A-Za-z0-9-]+\.arc.localhost)`\)/g);
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
        const exposed_port = port_pair && (port_pair as string).split(':')[0];
        this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}`);
      }
    }
    const project_name = flags.environment || DockerComposeUtils.DEFAULT_PROJECT;
    const compose_file = flags.compose_file || DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.safeDump(compose));
    this.log(`Wrote docker-compose file to: ${compose_file}`);
    const compose_args = ['-f', compose_file, '-p', project_name, '--compatibility', 'up', '--abort-on-container-exit', '--timeout', '0'];
    if (flags.build_parallel) {
      await execa('docker-compose', ['-f', compose_file, '-p', project_name, 'build', '--parallel'], { stdio: 'inherit' });
    } else {
      compose_args.push('--build');
    }
    if (flags.detached) {
      compose_args.push('-d');
      compose_args.splice(compose_args.indexOf('--abort-on-container-exit'), 1); // cannot be used in detached mode
    }

    if (!isCi && flags.browser) {
      let open_browser_attempts = 0;
      const poll_interval = 2000;
      const browser_interval = setInterval(async () => {
        if (open_browser_attempts === 300) {
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

    await execa('docker-compose', compose_args, { stdio: 'inherit' });
  }

  private readValuesFile(values_file_path: string | undefined) {
    let component_values: any = {};
    if (values_file_path && fs.statSync(values_file_path)) {
      const values_file_data = fs.readFileSync(values_file_path);
      component_values = yaml.safeLoad(values_file_data.toString('utf-8'), { schema: FAILSAFE_SCHEMA });
    }
    return component_values;
  }

  getExtraEnvironmentVariables(parameters: string[]) {
    const extra_env_vars: { [s: string]: string | undefined } = {};

    for (const [param_name, param_value] of Object.entries(process.env || {})) {
      if (param_name.startsWith('ARC_')) {
        extra_env_vars[param_name.substring(4)] = param_value;
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

  private getComponentValues() {
    const { flags } = this.parse(Deploy);
    const component_values = this.readValuesFile(flags.values);
    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    if (extra_params && Object.keys(extra_params).length) {
      if (!component_values['*']) {
        component_values['*'] = {};
      }
      component_values['*'] = { ...component_values['*'], ...extra_params };
    }
    return component_values;
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

    if (!flags.values && fs.existsSync('./values.yml')) {
      flags.values = './values.yml';
    }

    if (!args.configs_or_components || !args.configs_or_components.length) {
      args.configs_or_components = ['./architect.yml'];
    }

    const interfaces_map = this.getInterfacesMap();
    const component_values = this.getComponentValues();

    const linked_components = this.app.linkedComponents;
    const component_versions: string[] = [];
    for (const config_or_component of args.configs_or_components) {

      let component_version = config_or_component;
      if (!ComponentVersionSlugUtils.Validator.test(config_or_component) && !ComponentSlugUtils.Validator.test(config_or_component)) {
        const component_config = await ComponentConfigBuilder.buildFromPath(config_or_component);
        linked_components[component_config.getName()] = config_or_component;
        component_version = component_config.getName();

        if (Object.keys(interfaces_map).length === 0) {
          for (const interface_name of Object.keys(component_config.getInterfaces())) {
            interfaces_map[interface_name] = interface_name;
          }
        }
      }
      component_versions.push(component_version);
    }

    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      linked_components,
    );

    const component_configs: ComponentConfig[] = [];
    for (const component_version of component_versions) {
      const component_config = await dependency_manager.loadComponentConfig(component_version, interfaces_map);

      if (flags.recursive) {
        const dependency_configs = await dependency_manager.loadComponentConfigs(component_config);
        component_configs.push(...dependency_configs);
      } else {
        component_configs.push(component_config);
      }
    }

    const graph = await dependency_manager.getGraph(component_configs, component_values);

    const compose = await DockerComposeUtils.generate(graph);
    await this.runCompose(compose);
  }

  protected async runRemote() {
    const { args, flags } = this.parse(Deploy);

    const components = args.configs_or_components;

    const interfaces_map = this.getInterfacesMap();
    const component_values = this.getComponentValues();

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const deployment_dtos = [];
    for (const component of components) {
      if (ComponentVersionSlugUtils.Validator.test(component)) {
        const parsed_component_version = ComponentVersionSlugUtils.parse(component);
        const namespaced_component_name = ComponentSlugUtils.build(parsed_component_version.component_account_name, parsed_component_version.component_name);
      }

      const deploy_dto = {
        component: component,
        interfaces: interfaces_map,
        recursive: flags.recursive,
        values: component_values,
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
      approved_pipelines.map(async (pipeline) => {
        await PipelineUtils.pollPipeline(this.app.api, pipeline.pipeline.id);
        this.log(chalk.green(`${pipeline.component_name} Deployed`));
      })
    );
    cli.action.stop();
  }

  async run() {
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
