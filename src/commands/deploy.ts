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
import DependencyGraph from '../dependency-manager/src/graph';


class EnvConfigRequiredError extends Error {
  constructor() {
    super();
    this.name = 'environment_config_required';
    this.message = 'An environment configuration is required';
  }
}

enum ValidationSeverity {
  INFO = 0,
  WARNING = 1,
  ERROR = 2,
}

interface ValidationResult {
  valid: boolean;
  slug: string;
  rule: string;
  doc_ref: string;
  severity: ValidationSeverity;
  details?: string;
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
      description: 'Build without the ARCHITECT_DEBUG flag and mounted volumes',
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
      const gateway_port = gateway.ports[0].split(':')[0];
      for (const [service_name, service] of Object.entries(compose.services)) {
        if (service.environment && service.environment.VIRTUAL_HOST) {
          const service_host = `http://${service.environment.VIRTUAL_HOST}:${gateway_port}/`;
          this.log(`${chalk.blue(service_host)} => ${service_name}`);
        }
      }
      this.log('');
    }

    Object.keys(compose.services).forEach(svc_name => {
      const exposed_port = compose.services[svc_name].ports[0].split(':')[0];
      this.log(`${chalk.blue(`http://localhost:${exposed_port}/`)} => ${svc_name}`);
    });
    await fs.ensureFile(flags.compose_file);
    await fs.writeJSON(flags.compose_file, compose, { spaces: 2 });
    this.log(`Wrote docker-compose file to: ${flags.compose_file}`);
    await execa('docker-compose', ['-f', flags.compose_file, 'up', '--build', '--abort-on-container-exit'], { stdio: 'inherit' });
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

    await this.validate_graph(dependency_manager.graph);

    const compose = DockerCompose.generate(dependency_manager, flags.build_prod);
    await this.runCompose(compose);
  }

  async poll(deployment_id: string, match_stage?: string) {
    return new Promise((resolve, reject) => {
      let poll_count = 0;
      const poll = setInterval(async () => {
        const { data: deployment } = await this.app.api.get(`/deploy/${deployment_id}`);
        if (deployment.failed_at || poll_count > 100) {
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
      }, 3000);
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
    const configPayload = fs.readJSONSync(env_config_path) as object;

    cli.action.start(chalk.blue('Creating deployment'));
    const { data: deployment } = await this.app.api.post(`/environments/${all_answers.environment_id}/deploy`, { config: configPayload });

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
      cli.action.stop(chalk.yellow(`Warning: Could not connect to the Architect API to validate the deployment, carrying on anyway...`));
      // we don't want to block local deployments from working without an internet connection so we play nice if the call fails
      return;
    }

    const failing_rules = validation_results.filter(r => !r.valid);
    const passing_rules = validation_results.filter(r => r.valid);
    const error_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.ERROR).length;
    const warning_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.WARNING).length;
    const info_count = failing_rules.filter(r => !r.valid && r.severity === ValidationSeverity.INFO).length;

    if (error_count || warning_count || info_count) {
      cli.action.stop(
        (error_count ? this.get_severity_color(ValidationSeverity.ERROR)(`${error_count} error${error_count > 1 ? 's ' : ' '}`) : ' ') +
        (warning_count ? this.get_severity_color(ValidationSeverity.WARNING)(`${warning_count} warning${warning_count > 1 ? 's ' : ' '}`) : ' ') +
        (info_count ? this.get_severity_color(ValidationSeverity.INFO)(`${info_count} info${info_count > 1 ? 's ' : ' '}`) : ' ')
      );
    } else {
      cli.action.stop(chalk.green(`${passing_rules.length} rules passing`));
    }

    if (failing_rules.length) {
      this.log('\n');
      for (const failure of failing_rules) {
        this.log_failure(failure);
      }
      this.log(chalk.blue(`...${passing_rules.length} other rules passing\n`));
    }

    if (error_count > 0) {
      this.error('The deployment failed validation.');
    }
  }

  private log_failure(failure: ValidationResult) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    const color_fnc = this.get_severity_color(failure.severity);

    this.log(color_fnc(ValidationSeverity[failure.severity] + ': ' + failure.rule));

    if (failure.details) {
      this.log(`\t${color_fnc('Details: ' + failure.details)}`);
    }
    this.log(`\t${color_fnc(failure.doc_ref)}`);
    this.log('\n');
  }

  private get_severity_color(severity: ValidationSeverity) {
    switch (severity) {
      case ValidationSeverity.ERROR:
        return chalk.red;
      case ValidationSeverity.WARNING:
        return chalk.yellow;
      case ValidationSeverity.INFO:
        return chalk.blue;
      default:
        return chalk.white;
    }
  }
}
