import chalk from 'chalk';
import BaseCommand from "../base-command";
import { DockerComposeUtils } from "../common/docker-compose";
import inquirer from 'inquirer';
import { DockerInspect } from '../common/docker-compose/template';

export default class StopLocalDeployment extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Stop a local deployment';
  static examples = [
    'architect stop <local-environment-name>',
  ];

  static flags = {
    ...BaseCommand.flags,
  };

  static args = [{
    sensitive: false,
    name: 'name',
    description: 'Name of local environment',
    required: false,
  }];

  async run(): Promise<void> {
    const { args } = await this.parse(StopLocalDeployment);

    const local_env_map = await DockerComposeUtils.getLocalEnvironmentContainerMap();
    const env_names = Object.keys(local_env_map);
    if (env_names.length === 0) {
      throw new Error(chalk.red(`No local deployment found.`));
    }

    if (!args.name) {
      const answers: { environment: string } = await inquirer.prompt([
        {
          type: 'list',
          name: 'environment',
          message: 'Select a local environment',
          choices: env_names,
        },
      ]);
      args.name = answers.environment;
    }

    if (!env_names.includes(args.name as string)) {
      throw new Error(chalk.red(`No local deployment named '${args.name}'. Use command 'architect dev:list' to list local deployments.`));
    }

    await DockerComposeUtils.dockerCompose(['-p', args.name, 'stop']);
    this.log(chalk.green(`Successfully stopped local deployment '${args.name}'.`));
  }
}
