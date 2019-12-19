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


class EnvConfigRequiredError extends Error {
  constructor() {
    super();
    this.name = 'environment_config_required';
    this.message = 'An environment configuration is required';
  }
}

export default class Deploy extends Command {
  static description = 'Create a deploy job on Architect Cloud or run stacks locally';

  static flags = {
    ...Command.flags,
    local: flags.boolean({
      char: 'l',
      description: 'Deploy the stack locally instead of via Architect Cloud',
    }),
    compose_file: flags.string({
      char: 'o',
      description: 'Path where the compose file should be written to',
      default: path.join(
        os.tmpdir(),
        `architect-deployment-${Date.now().toString()}.json`,
      ),
    }),
    account: flags.string({
      char: 'a',
      description: 'Account to deploy the services with'
    }),
    environment: flags.string({
      char: 'e',
      description: 'Environment to deploy the services to'
    }),
  };

  static args = [{
    name: 'environment_config',
    description: 'Path to an Architect environment config file',
  }];

  async runCompose(compose: DockerComposeTemplate) {
    const { flags } = this.parse(Deploy);
    Object.keys(compose.services).forEach(svc_name => {
      const exposed_port = compose.services[svc_name].ports[0].split(':')[0];
      this.log(`${chalk.blue(`0.0.0.0:${exposed_port}`)} => ${svc_name}`);
    });
    await fs.ensureFile(flags.compose_file);
    await fs.writeJSON(flags.compose_file, compose, { spaces: 2 });
    this.log(`Wrote docker-compose file to: ${flags.compose_file}`);
    // this.log(chalk.green(JSON.stringify(compose, null, 2)));
    await execa('docker-compose', ['-f', flags.compose_file, 'up', '--build', '--abort-on-container-exit'], { stdio: 'inherit' });
  }

  private async runLocal() {
    const { args } = this.parse(Deploy);

    if (!args.environment_config) {
      throw new EnvConfigRequiredError();
    }

    const dependency_manager = await LocalDependencyManager.createFromPath(
      this.app.api,
      path.resolve(untildify(args.environment_config)),
    );
    const compose = DockerCompose.generate(dependency_manager);
    await this.runCompose(compose);
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

    const user_accounts = await this.get_accounts();

    // Prompt user for required inputs if not set as flags
    const answers: any = await inquirer.prompt([{
      type: 'list',
      name: 'account',
      message: 'Which Architect account would you like to create this environment for?',
      choices: user_accounts.map((a: any) => { return { name: a.name, value: a.id } }),
      when: !flags.account,
    }]);

    if (!answers.account) {
      const account = user_accounts.filter((account: any) => account.name === flags.account);
      if (!account.length) {
        throw new Error(`Account with name ${flags.account} not found`);
      }
      answers.account = account[0].id;
    }

    const environments = (await this.app.api.get(`/accounts/${answers.account}/environments`)).data;

    // Prompt user for required inputs if not set as flags
    const env_answers = await inquirer.prompt([{
      type: 'list',
      name: 'environment_id',
      message: 'Which Architect environment would you like to deploy the services to?',
      choices: environments.map((a: any) => { return { name: a.name, value: a.id } }),
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
    const environment_name = environments.filter((env: any) => env.id === all_answers.environment_id)[0].name;

    cli.action.start(chalk.blue(`Deploying services`));
    await this.app.api.post(`/environments/${all_answers.environment_id}/deploy`, { environment: environment_name, config: configPayload });
    cli.action.stop(chalk.green(`Services deployed successfully`));
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
