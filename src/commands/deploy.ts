import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import yaml from 'js-yaml';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import * as DockerCompose from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import { OfflineUtils } from '../common/utils/offline';
import { ValidationClient, ValidationResult } from '../common/utils/validation';
import DependencyGraph from '../dependency-manager/src/graph';


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
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock'],
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: path.join(
        os.tmpdir(),
        `architect-deployment-${Date.now().toString()}.json`,
      ),
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock'],
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
    account: flags.string({
      char: 'a',
      description: 'Account to deploy the services with',
      exclusive: ['local', 'compose_file'],
    }),
    environment: flags.string({
      char: 'e',
      description: 'Environment to deploy the services to',
      exclusive: ['local', 'compose_file'],
    }),
    build_prod: flags.boolean({
      description: 'Build without debug config',
      hidden: true,
      exclusive: ['account', 'environment', 'auto_approve', 'lock', 'force_unlock'],
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

    Object.keys(compose.services).forEach(svc_name => {
      for (const port_pair of compose.services[svc_name].ports) {
        const exposed_port = port_pair && port_pair.split(':')[0];
        this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}`);
      }
    });
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
      !flags.build_prod,
    );

    await this.validate_graph(dependency_manager.graph);

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

  private async runRemote() {
    const { args, flags } = this.parse(Deploy);

    if (!args.environment_config) {
      throw new EnvConfigRequiredError();
    }

    const env_config_path = path.resolve(untildify(args.environment_config));
    if (!fs.existsSync(env_config_path)) {
      throw new Error(`No file found at ${env_config_path}`);
    }

    const { rows: user_accounts } = await this.get_accounts();

    // Prompt user for required inputs if not set as flags
    const answers: any = await inquirer.prompt([{
      type: 'list',
      name: 'account',
      message: 'Which account would you like to deploy to?',
      choices: user_accounts.map((a: any) => { return { name: a.name, value: a.id }; }),
      when: !flags.account,
    }]);

    if (!answers.account) {
      const account = user_accounts.filter((account: any) => account.name === flags.account);
      if (!account.length) {
        throw new Error(`Account with name ${flags.account} not found`);
      }
      answers.account = account[0].id;
    }

    const { rows: environments } = (await this.app.api.get(`/accounts/${answers.account}/environments`)).data;

    // Prompt user for required inputs if not set as flags
    const env_answers = await inquirer.prompt([{
      type: 'list',
      name: 'environment_id',
      message: 'Which environment would you like to deploy to?',
      choices: environments.map((a: any) => { return { name: a.name, value: a.id }; }),
      when: !flags.environment,
    }]);

    if (!env_answers.environment_id) {
      const environment = environments.filter((env: any) => env.name === flags.environment);
      if (!environment.length) {
        throw new Error(`Environment with name ${flags.environment} not found`);
      }
      env_answers.environment_id = environment[0].id;
    }

    const all_answers = { ...args, ...flags, ...answers, ...env_answers };
    let config_payload;
    if (env_config_path.endsWith('.yml') || env_config_path.endsWith('.yaml')) {
      const file_contents = fs.readFileSync(env_config_path, 'utf-8');
      config_payload = yaml.safeLoad(file_contents);
    } else {
      config_payload = fs.readJSONSync(env_config_path) as object;
    }

    cli.action.start(chalk.blue('Creating deployment'));
    const { data: deployment } = await this.app.api.post(`/environments/${all_answers.environment_id}/deploy`, { config: config_payload });

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
    await this.app.api.post(`/deploy/${deployment.id}`, {}, { params: { lock: flags.lock, force_unlock: flags.force_unlock } });
    await this.poll(deployment.id);
    cli.action.stop(chalk.green(`Deployed`));
  }

  async run() {
    const { flags } = this.parse(Deploy);

    if (flags.local) {
      await this.runLocal();
    } else {
      await this.runRemote();
    }
  }

  async validate_graph(graph: DependencyGraph): Promise<void> {
    cli.action.start(chalk.blue('Validating deployment'));

    let validation_results;
    try {
      const response = await this.app.api.post<ValidationResult[]>(`/graph/validation`, graph, { timeout: 2000 });
      validation_results = response.data;
    } catch (err) {
      // we don't want to block local deployments from working without an internet connection so we play nice if the call fails
      if (OfflineUtils.indicates_offline(err)) {
        cli.action.stop(chalk.yellow(`Warning: Could not connect to the Architect API to validate the service config, carrying on anyway...`));
        return;
      } else {
        cli.action.stop(chalk.red(`Error, did not run validation: ${err.response?.data?.message || err.message}`));
        return;
      }
    }

    const summary = ValidationClient.summarize(validation_results);
    if (summary.all_passing) {
      cli.action.stop(chalk.green(`${summary.passing_count} rules passing`));
    } else {
      cli.action.stop(summary.message);
    }

    if (!summary.all_passing) {
      this.log('\n');
      this.log(summary.failure_report);
      this.log(chalk.blue(`...${summary.passing_count} other rules passing\n`));
    }

    if (summary.blocker_count > 0) {
      this.error('The deployment failed validation.');
    }
  }
}
