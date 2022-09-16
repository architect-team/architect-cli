import chalk from 'chalk';
import BaseCommand from "../base-command";
import { DockerComposeUtils } from "../common/docker-compose";
import inquirer from 'inquirer';
import { RequiresDocker } from '../common/docker/helper';

export default class Stop extends BaseCommand {
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

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    const { args } = await this.parse(Stop);

    const env_names = await DockerComposeUtils.getLocalEnvironments();
    if (env_names.length === 0) {
      throw new Error(chalk.red(`No local deployment found.`));
    }

    const answers: { name: string } = await inquirer.prompt([
      {
        type: 'list',
        name: 'name',
        when: !args.name,
        message: 'Select a local environment',
        choices: env_names,
      },
    ]);

    const name = args.name || answers.name;
    if (!env_names.includes(name as string)) {
      throw new Error(chalk.red(`No local deployment named '${name}'. Use command 'architect dev:list' to list local deployments.`));
    }

    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), name);
    await DockerComposeUtils.dockerCompose(['-p', name, '-f', compose_file, 'stop']);
    this.log(chalk.green(`Successfully stopped local deployment '${name}'.`));
  }
}
