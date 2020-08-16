import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import * as DockerCompose from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { AccountUtils } from '../common/utils/account';
import { Environment, EnvironmentUtils } from '../common/utils/environment';
import { ComponentVersionSlugUtils, EnvironmentConfig } from '../dependency-manager/src';
import { EnvironmentConfigBuilder } from '../dependency-manager/src/environment-config/builder';
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
    refresh: flags.boolean({
      default: true,
      hidden: true,
      allowNo: true,
      exclusive: ['local', 'compose_file'],
    }),
  };

  async poll(deployment_id: string, match_stage?: string) {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: deployment } = await this.app.api.get(`/deploy/${deployment_id}`);
        if (deployment.failed_at || poll_count > 180) {  // Stop checking after 30min (180 * 10s)
          clearInterval(poll);
          reject(new Error('Deployment failed'));
        }

        if (match_stage) {
          if (deployment.stage === match_stage) {
            clearInterval(poll);
            resolve(deployment);
          }
        } else if (deployment.applied_at) {
          clearInterval(poll);
          resolve(deployment);
        }
        poll_count += 1;
      }, DeployCommand.POLL_INTERVAL);
    });
  }

  async deployRemote(environment: Environment, env_config: EnvironmentConfig, merge: boolean) {
    const { flags } = this.parse(this.constructor as typeof DeployCommand);

    cli.action.start(chalk.blue('Creating deployment'));
    const { data: deployment } = await this.app.api.post(`/environments/${environment.id}/deploy`, { config: env_config, merge: merge });
    cli.action.stop();
    if (!flags.auto_approve) {
      this.log(`Deployment ready for review: ${this.app.config.app_host}/${deployment.environment.account.name}/environments/${deployment.environment.name}/deployments/${deployment.id}`);
      const confirmation = await inquirer.prompt({
        type: 'confirm',
        name: 'deploy',
        message: 'Would you like to apply?',
      });
      if (!confirmation.deploy) {
        this.warn('Canceled deploy');
        return;
      }
    }

    cli.action.start(chalk.blue('Deploying'));
    await this.app.api.post(`/deploy/${deployment.id}`, {}, { params: { lock: flags.lock, force_unlock: flags.force_unlock, refresh: flags.refresh } });
    await this.poll(deployment.id);
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
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: path.join(
        os.tmpdir(),
        `architect-deployment-${Date.now().toString()}.json`,
      ),
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
  };

  static args = [{
    name: 'environment_config_or_component',
    description: 'Path to an environment config file or component `account/component:latest`',
    required: true,
  }];

  async runCompose(compose: DockerComposeTemplate) {
    const { flags } = this.parse(Deploy);

    const gateway = compose.services['gateway'];
    if (gateway) {
      const gateway_port = gateway.ports[0] && gateway.ports[0].split(':')[0];
      for (const [service_name, service] of Object.entries(compose.services)) {
        if (service.environment && service.environment.VIRTUAL_HOST) {
          const service_host = `http://${service.environment.VIRTUAL_HOST}:${gateway_port}/`;
          this.log(`${chalk.blue(service_host)} => ${service_name}`);
        }
      }
      this.log('');
    }

    for (const svc_name of Object.keys(compose.services)) {
      for (const port_pair of compose.services[svc_name].ports) {
        const exposed_port = port_pair && port_pair.split(':')[0];
        this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}`);
      }
    }
    await fs.ensureFile(flags.compose_file);
    await fs.writeJSON(flags.compose_file, compose, { spaces: 2 });
    this.log(`Wrote docker-compose file to: ${flags.compose_file}`);
    const compose_args = ['-f', flags.compose_file, 'up', '--build', '--abort-on-container-exit'];
    if (flags.detached) {
      compose_args.push('-d');
      compose_args.splice(compose_args.indexOf('--abort-on-container-exit'), 1); // cannot be used in detached mode
    }
    await execa('docker-compose', compose_args, { stdio: 'inherit' });
  }

  private async runLocal() {
    const { args, flags } = this.parse(Deploy);

    let dependency_manager;
    if (ComponentVersionSlugUtils.Validator.test(args.environment_config_or_component)) {
      const parsed_component_version = ComponentVersionSlugUtils.parse(args.environment_config_or_component);
      const env_config = EnvironmentConfigBuilder.buildFromJSON({
        components: {
          [parsed_component_version.namespaced_component_name]: {
            extends: parsed_component_version.tag,
            parameters: this.getExtraEnvironmentVariables(flags.parameter),
          },
        },
      });

      dependency_manager = await LocalDependencyManager.create(this.app.api);
      dependency_manager.environment = env_config;

      const extra_interfaces = this.getExtraInterfaces(flags.interface);
      this.updateEnvironmentInterfaces(env_config, extra_interfaces, parsed_component_version.namespaced_component_name);
    } else {
      if (flags.interface.length) { throw new Error('Cannot combine interface flag with an environment config'); }

      dependency_manager = await LocalDependencyManager.createFromPath(
        this.app.api,
        path.resolve(untildify(args.environment_config_or_component)),
      );

      const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
      this.updateEnvironmentParameters(dependency_manager.environment, extra_params);
    }

    dependency_manager.setLinkedComponents(this.app.linkedComponents);
    const compose = await DockerCompose.generate(dependency_manager);
    await this.runCompose(compose);
  }

  protected async runRemote() {
    const { args, flags } = this.parse(Deploy);

    let env_config: EnvironmentConfig;

    let env_config_merge: boolean;
    if (ComponentVersionSlugUtils.Validator.test(args.environment_config_or_component)) {
      const parsed_component_version = ComponentVersionSlugUtils.parse(args.environment_config_or_component);
      env_config = EnvironmentConfigBuilder.buildFromJSON({
        components: {
          [parsed_component_version.namespaced_component_name]: {
            extends: parsed_component_version.tag,
            parameters: this.getExtraEnvironmentVariables(flags.parameter),
          },
        },
      });

      const extra_interfaces = this.getExtraInterfaces(flags.interface);
      this.updateEnvironmentInterfaces(env_config, extra_interfaces, parsed_component_version.namespaced_component_name);

      env_config_merge = true;
    } else {
      if (flags.interface.length) { throw new Error('Cannot combine interface flag with an environment config'); }

      const env_config_path = path.resolve(untildify(args.environment_config_or_component));
      // Validate env config
      env_config = await EnvironmentConfigBuilder.buildFromPath(env_config_path);
      for (const [ck, cv] of Object.entries(env_config.getComponents())) {
        if (cv.getExtends()?.startsWith('file:')) {
          this.error(`Cannot deploy component remotely with file extends: ${ck}: ${cv.getExtends()}`);
        }
      }

      const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
      this.updateEnvironmentParameters(env_config, extra_params);

      env_config_merge = false;
    }

    const account = await AccountUtils.getAccount(this.app.api, flags.account);
    const environment = await EnvironmentUtils.getEnvironment(this.app.api, account, flags.environment);
    await this.deployRemote(environment, env_config, env_config_merge);
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
      if (interface_split.length !== 2) {
        throw new Error(`Bad format for interface ${component_interface}. Please specify in the format --interface subdomain:component_interface`);
      }
      extra_interfaces[interface_split[0]] = interface_split[1];
    }
    return extra_interfaces;
  }

  updateEnvironmentParameters(env_config: EnvironmentConfig, extra_params: Dictionary<string | undefined>) {
    for (const [param_name, param_value] of Object.entries(extra_params)) {
      if (env_config.getParameters()[param_name] === undefined) {
        throw new Error(`Parameter ${param_name} not found in env config`);
      }
      env_config.setParameter(param_name, param_value);
    }
  }

  updateEnvironmentInterfaces(env_config: EnvironmentConfig, extra_interfaces: Dictionary<string>, component_name: string) {
    for (const [subdomain, interface_name] of Object.entries(extra_interfaces)) {
      env_config.setInterface(subdomain, `\${components['${component_name}'].interfaces.${interface_name}.url}`);
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
