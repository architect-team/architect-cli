import { CliUx } from '@oclif/core';
import chalk from 'chalk';
import * as fs from 'fs-extra';
import inquirer from 'inquirer';
import path from 'path';
import BaseCommand from "../../base-command";
import { DockerComposeUtils } from "../../common/docker-compose";
import { RequiresDocker } from '../../common/docker/helper';
import { ArchitectError } from '../../dependency-manager/utils/errors';

export default class DevStop extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Stop a local deployment';
  static examples = [
    'architect dev:stop <local-environment-name>',
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

  async waitForEnviromentToStop(environment: string): Promise<boolean> {
    let attempts = 0;
    // Essentially add a 2 mintue timeout
    while (attempts < 180) {
      const environments = await DockerComposeUtils.getLocalEnvironments();
      if (environments.includes(environment)) {
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
      } else {
        return true;
      }
      attempts++;
    }
    return false;
  }

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    const { args } = await this.parse(DevStop);

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

    const config_file = path.join(this.config.configDir, 'env_pids.json');
    const env_pids = JSON.parse((await fs.readFile(config_file)).toString());
    const pid = env_pids[name];
    process.kill(pid, 'SIGINT');

    CliUx.ux.action.start(chalk.blue(`Waiting for ${name} to stop...`));
    const did_stop = await this.waitForEnviromentToStop(name);
    CliUx.ux.action.stop();
    if (did_stop) {
      this.log(chalk.green(`Successfully stopped local deployment '${name}'.`));
    } else {
      this.error(new ArchitectError(`Unable to stop ${name}`));
    }
  }
}
