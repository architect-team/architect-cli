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
import { EnvironmentSlugUtils } from '../dependency-manager/src';
import { EnvironmentConfigBuilder } from '../dependency-manager/src/environment-config/builder';

class EnvConfigRequiredError extends Error {
  constructor() {
    super();
    this.name = 'environment_config_required';
    this.message = 'An environment configuration is required';
  }
}

export default class Deploy extends Command {
  auth_required() {
    const { flags } = this.parse(Deploy);
    return !flags.local;
  }

  static description = 'Create a deploy job on Architect Cloud or run stacks locally';

  static flags = {
    ...Command.flags,
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
    environment: flags.string({
      char: 'e',
      description: 'Fully qualified environment name in the form my-account/environment-name',
      exclusive: ['local', 'compose_file'],
    }),
    platform: flags.string({
      description: 'Fully qualified platform name in the form my-account/platform-name',
      exclusive: ['local', 'compose_file'],
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
  };

  static args = [{
    name: 'environment_config',
    description: 'Path to an environment config file',
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

    if (!args.environment_config) {
      throw new EnvConfigRequiredError();
    }

    const dependency_manager = await LocalDependencyManager.createFromPath(
      this.app.api,
      path.resolve(untildify(args.environment_config)),
      this.app.linkedServices,
    );

    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    for (const param_name of Object.keys(extra_params)) {
      if (dependency_manager.environment.getParameters()[param_name] === undefined) {
        throw new Error(`Parameter ${param_name} not found in env config`);
      }
    }
    dependency_manager.environment.setParameters(Object.assign({}, dependency_manager.environment.getParameters(), extra_params));

    const compose = await DockerCompose.generate(dependency_manager);
    await this.runCompose(compose);
  }

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
      }, 10000);
    });
  }

  protected async runRemote() {
    const { args, flags } = this.parse(Deploy);

    if (!args.environment_config) {
      throw new EnvConfigRequiredError();
    }

    const env_config_path = path.resolve(untildify(args.environment_config));
    // Validate env config
    const env_config = await EnvironmentConfigBuilder.buildFromPath(env_config_path);
    for (const [ck, cv] of Object.entries(env_config.getComponents())) {
      if (cv.getExtends()?.startsWith('file:')) {
        this.error(`Cannot deploy component remotely with file extends: ${ck}: ${cv.getExtends()}`);
      }
    }

    const extra_params = this.getExtraEnvironmentVariables(flags.parameter);
    for (const param_name of Object.keys(extra_params)) {
      if (env_config.getParameters()[param_name] === undefined) {
        throw new Error(`Parameter ${param_name} not found in env config`);
      }
    }
    env_config.setParameters(Object.assign({}, env_config.getParameters(), extra_params));

    let environment_id;
    let environment_answers: any = {};
    if (!flags.environment) {
      environment_answers = await inquirer.prompt([{
        type: 'input',
        name: 'environment_name',
        message: 'What is the name of the environment would you like to deploy to?',
        validate: this.validateEnvironmentNamespacedInput,
      }]);
    } else {
      const validation_err = this.validateEnvironmentNamespacedInput(flags.environment);
      if (typeof validation_err === 'string') { throw new Error(validation_err); }
      environment_answers.environment_name = flags.environment;
    }

    const [account_name, environment_name] = environment_answers.environment_name.split('/');
    const account = (await this.app.api.get(`/accounts/${account_name.toLowerCase()}`)).data;

    try {
      const { data: environment } = await this.app.api.get(`/accounts/${account.id}/environments/${environment_name.toLowerCase()}`);
      environment_id = environment.id;
    } catch (err) {
      let platform_answers: any = {};
      if (err.response.status === 404) {
        if (!flags.platform) {
          platform_answers = await inquirer.prompt([{
            type: 'input',
            name: 'platform_name',
            message: 'What is the name of the platform would you like to create the environment on?',
            validate: this.validatePlatformNamespacedInput,
          }]);
        } else {
          const validation_err = this.validatePlatformNamespacedInput(flags.platform);
          if (typeof validation_err === 'string') { throw new Error(validation_err); }
          platform_answers.platform_name = flags.platform;
        }
      } else { throw err; }

      const { data: platform } = await this.app.api.get(`/accounts/${account.id}/platforms/${platform_answers.platform_name.split('/')[1]}`);
      cli.action.start(chalk.blue('Registering environment with Architect'));
      const { data: created_environment } = await this.app.api.post(`/accounts/${account.id}/environments`, {
        name: environment_name,
        platform_id: platform.id,
      });
      cli.action.stop();
      environment_id = created_environment.id;
    }

    cli.action.start(chalk.blue('Creating deployment'));
    const { data: deployment } = await this.app.api.post(`/environments/${environment_id}/deploy`, { config: env_config });

    if (!flags.auto_approve) {
      await this.poll(deployment.id, 'verify');
      cli.action.stop();
      this.log(`Review: ${this.app.config.app_host}/${deployment.environment.account.name}/environments/${deployment.environment.name}/deployments/${deployment.id}`);
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
    cli.action.stop(chalk.green(`Deployed`));
  }

  validateEnvironmentNamespacedInput(value: string) {
    if (!EnvironmentSlugUtils.Validator.test(value)) {
      return 'Environments ' + EnvironmentSlugUtils.Description;
    }
    return true;
  }

  validatePlatformNamespacedInput(value: string) {
    if (!EnvironmentSlugUtils.Validator.test(value)) {
      return 'Platforms ' + EnvironmentSlugUtils.Description;
    }
    return true;
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

  async run() {
    const { flags } = this.parse(Deploy);

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }
}
