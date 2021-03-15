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
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { AccountUtils } from '../common/utils/account';
import * as Docker from '../common/utils/docker';
import { EnvironmentUtils } from '../common/utils/environment';
import { ComponentSlugUtils, ComponentVersionSlugUtils, EnvironmentConfig } from '../dependency-manager/src';
import { EnvironmentConfigBuilder } from '../dependency-manager/src/spec/environment/environment-builder';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';

export abstract class DeployCommand extends Command {
  static POLL_INTERVAL = 10000;

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
      default: false,
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

  async poll(pipeline_id: string) {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: pipeline } = await this.app.api.get(`/pipelines/${pipeline_id}`);
        if (pipeline.failed_at || poll_count > 180) {  // Stop checking after 30min (180 * 10s)
          clearInterval(poll);
          reject(new Error('Pipeline failed'));
        }
        if (pipeline.applied_at) {
          clearInterval(poll);
          resolve(pipeline);
        }
        poll_count += 1;
      }, DeployCommand.POLL_INTERVAL);
    });
  }

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
        this.warn('Canceled pipeline');
        return;
      }
    }

    cli.action.start(chalk.blue('Deploying'));
    await this.app.api.post(`/pipelines/${pipeline.id}/approve`);
    await this.poll(pipeline.id);
    cli.action.stop();
    this.log(chalk.green(`Deployed`));
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
    name: 'config_or_component',
    description: 'Path to an architect.yml file or component `account/component:latest`',
  }];

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
            const host = new RegExp(/Host\(`([A-Za-z0-9-]+\.localhost)`\)/g);
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
    const compose_args = ['-f', compose_file, '-p', project_name, '--compatibility', 'up', '--abort-on-container-exit'];
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

  private async runLocal() {
    const { args, flags } = this.parse(Deploy);
    await Docker.verify();

    if (!flags.values && fs.existsSync('./values.yml')) {
      flags.values = './values.yml';
    }

    const component_values = this.readValuesFile(flags.values);

    let dependency_manager;
    let namespaced_component_name;

    if (!args.config_or_component) {
      args.config_or_component = './architect.yml';
    }

    // try loading the `config_or_component` as a relative path. if that fails, assume it is a component slug (which assumes 'latest' tag if none provided)
    try {
      dependency_manager = await LocalDependencyManager.createFromPath(
        this.app.api,
        path.resolve(untildify(args.config_or_component)),
        component_values,
        {}
      );
      namespaced_component_name = Object.keys(dependency_manager.environment.getComponents())[0];
    } catch (err) {
      if (ComponentVersionSlugUtils.Validator.test(args.config_or_component) || ComponentSlugUtils.Validator.test(args.config_or_component)) {
        const parsed_component_version = ComponentVersionSlugUtils.parse(args.config_or_component);
        namespaced_component_name = ComponentSlugUtils.build(parsed_component_version.component_account_name, parsed_component_version.component_name);

        const env_config = EnvironmentConfigBuilder.buildFromJSON({
          components: {
            [namespaced_component_name]: parsed_component_version.tag,
          },
        });

        dependency_manager = await LocalDependencyManager.create(this.app.api, component_values);
        dependency_manager.environment = env_config;
      } else {
        throw err;
      }
    }

    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    for (const [parameter_key, parameter] of Object.entries(extra_params)) {
      dependency_manager.environment.setParameter(parameter_key, parameter);
    }
    const extra_interfaces = this.getExtraInterfaces(flags.interface);
    this.updateEnvironmentInterfaces(dependency_manager.environment, extra_interfaces, namespaced_component_name);

    dependency_manager.setLinkedComponents(this.app.linkedComponents);
    const compose = await DockerComposeUtils.generate(dependency_manager);
    await this.runCompose(compose);
  }

  protected async runRemote() {
    const { args, flags } = this.parse(Deploy);

    if (ComponentVersionSlugUtils.Validator.test(args.config_or_component)) {
      const parsed_component_version = ComponentVersionSlugUtils.parse(args.config_or_component);
      const namespaced_component_name = ComponentSlugUtils.build(parsed_component_version.component_account_name, parsed_component_version.component_name);
    }

    /* TODO:320 kill -p flag?
    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    for (const [parameter_key, parameter] of Object.entries(extra_params)) {
      env_config.setParameter(parameter_key, parameter);
    }
    */

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);

    const interfaces_map: Dictionary<string> = {};
    for (const i of flags.interface) {
      const [key, value] = i.split(':');
      interfaces_map[key] = value || key;
    }

    cli.action.start(chalk.blue('Creating pipeline'));
    const { data: pipeline } = await this.app.api.post(`/environments/${environment.id}/deploy`, {
      component: args.config_or_component,
      interfaces: interfaces_map,
      recursive: flags.recursive,
    });
    cli.action.stop();

    await this.approvePipeline(pipeline);
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

  getExtraInterfaces(interfaces: string[]) {
    const extra_interfaces: { [s: string]: string } = {};
    for (const component_interface of interfaces) {
      const interface_split = component_interface.split(':');
      extra_interfaces[interface_split[0]] = interface_split[1] || interface_split[0];
    }
    return extra_interfaces;
  }

  updateEnvironmentInterfaces(env_config: EnvironmentConfig, extra_interfaces: Dictionary<string>, component_name: string) {
    for (const [subdomain, interface_name] of Object.entries(extra_interfaces)) {
      env_config.setInterface(subdomain, `\${{ components['${component_name}'].interfaces.${interface_name}.url }}`);
    }
  }

  async run() {
    const { flags } = this.parse(Deploy);

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }
}
