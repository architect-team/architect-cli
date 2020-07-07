import { flags } from '@oclif/command';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
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
import { EnvironmentConfigBuilder } from '../dependency-manager/src/environment-config/builder';

interface CreateEnvironmentInput {
  name: string;
  namespace?: string;
  platform_id: string;
  config?: string;
}

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
      char: 'p',
      description: 'Fully qualified platform name in the form my-account/platform-name',
      exclusive: ['local', 'compose_file'],
    }),
    build_prod: flags.boolean({
      description: 'Build without debug config',
      hidden: true,
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock', 'refresh'],
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
    if (!fs.existsSync(env_config_path)) {
      throw new Error(`No file found at ${env_config_path}`);
    }

    const { rows: user_accounts } = await this.get_accounts();
    let environment_id;

    if (!flags.platform && !flags.environment) {
      const environment_answers = await inquirer.prompt([{
        type: 'input',
        name: 'environment_name',
        message: 'What is the name of the environment would you like to deploy to?', // TODO: error checking
      }]);

      const [account_name, environment_name] = environment_answers.environment_name.split('/');
      const account = user_accounts.find((account: any) => account.name.toLowerCase() === account_name.toLowerCase()); // TODO: check if exists

      const { rows: environments } = (await this.app.api.get(`/accounts/${account.id}/environments`)).data;

      const environment = environments.find((environment: any) => environment.name.toLowerCase() === environment_name.toLowerCase());

      if (environment) {
        environment_id = environment.id;
      } else {
        const platform_answers = await inquirer.prompt([{
          type: 'input',
          name: 'platform_name',
          message: 'What is the name of the platform would you like to create the environment on?', // TODO: error checking
        }]);

        const { rows: platforms } = (await this.app.api.get(`/accounts/${account.id}/platforms`)).data;

        cli.action.start(chalk.blue('Registering environment with Architect'));
        const created_environment = await this.post_environment_to_api({
          name: environment_name,
          platform_id: platforms.find((platform: any) => platform.name.toLowerCase() === platform_answers.platform_name.split('/')[1].toLowerCase()).id, // TODO: error checking
        }, account.id);
        cli.action.stop();
        environment_id = created_environment.id;
      }
    } else if (flags.environment && !flags.platform) {

      if (flags.environment.split('/').length !== 2) {
        throw new Error('Environment name must be in the form my-account/environment-name');
      }

      const [account_name, env_name] = flags.environment.split('/');
      const environment_account = user_accounts.find((a: any) => a.name === account_name);
      if (!environment_account) {
        throw new Error(`Account=${account_name} does not exist or you do not have access to it.`);
      }

      const { rows: environments } = (await this.app.api.get(`/accounts/${environment_account.id}/environments`)).data;
      const environment = environments.find((environment: any) => environment.name.toLowerCase() === env_name.toLowerCase());
      if (!environment) {
        throw new Error(`Environment with name ${flags.environment} not found`); // TODO: prompt for platform if env not found, then create env on platform? probably not
      }
      environment_id = environment.id;
    } else if (flags.platform && !flags.environment) {

      if (flags.platform.split('/').length !== 2) {
        throw new Error('Platform name must be in the form my-account/platform-name');
      }

      const [account_name, platform_name] = flags.platform.split('/');
      const platform_account = user_accounts.find((a: any) => a.name === account_name);
      if (!platform_account) {
        throw new Error(`Account=${account_name} does not exist or you do not have access to it.`);
      }

      const { rows: environments } = (await this.app.api.get(`/accounts/${platform_account.id}/environments`)).data;

      const env_answers = await inquirer.prompt([{
        type: 'input',
        name: 'environment_name',
        message: 'What is the name of the environment would you like to deploy to?', // TODO: error checking
      }]);

      const environment = environments.find((environment: any) => env_answers.environment_name.split('/')[1].toLowerCase() === environment.name.toLowerCase());

      if (!environment) {
        const { rows: platforms } = (await this.app.api.get(`/accounts/${platform_account.id}/platforms`)).data;

        cli.action.start(chalk.blue('Registering environment with Architect'));
        const created_environment = await this.post_environment_to_api({
          name: env_answers.environment_name.split('/')[1],
          platform_id: platforms.find((platform: any) => platform.name.toLowerCase() === platform_name.toLowerCase()).id,
        }, platform_account.id);
        cli.action.stop();
        environment_id = created_environment.id;
      } else {
        environment_id = environment.id;
      }
    } else if (flags.environment && flags.platform) { // both flags exist, check for env and create if necessary
      if (flags.environment.split('/').length !== 2) {
        throw new Error('Environment name must be in the form my-account/environment-name');
      }

      const [account_name, environment_name] = flags.environment.split('/');
      const environment_account = user_accounts.find((a: any) => a.name === account_name);
      if (!environment_account) {
        throw new Error(`Account=${account_name} does not exist or you do not have access to it.`);
      }

      const { rows: environments } = (await this.app.api.get(`/accounts/${environment_account.id}/environments`)).data;
      const environment = environments.find((environment: any) => environment_name.toLowerCase() === environment.name.toLowerCase());
      if (!environment) {
        const { rows: platforms } = (await this.app.api.get(`/accounts/${environment_account.id}/platforms`)).data;

        cli.action.start(chalk.blue('Registering environment with Architect'));
        const created_environment = await this.post_environment_to_api({
          name: flags.environment.split('/')[1], // TODO: error checking
          platform_id: platforms.find((platform: any) => platform.name.toLowerCase() === flags.platform?.split('/')[1].toLowerCase()).id,
        }, environment_account.id);
        cli.action.stop();
        environment_id = created_environment.id;
      } else {
        environment_id = environment.id;
      }
    }

    // const all_answers = { ...args, ...flags, ...answers, ...env_answers };
    const config_payload = classToPlain(await EnvironmentConfigBuilder.buildFromPath(env_config_path));

    cli.action.start(chalk.blue('Creating deployment'));
    const { data: deployment } = await this.app.api.post(`/environments/${environment_id}/deploy`, { config: config_payload });

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

  private async post_environment_to_api(data: CreateEnvironmentInput, account_id: string): Promise<any> {
    const { data: environment } = await this.app.api.post(`/accounts/${account_id}/environments`, data);
    return environment;
  }

  private async register_architect_environment() {

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
