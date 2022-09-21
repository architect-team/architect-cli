import { CliUx } from '@oclif/core';
import chalk from 'chalk';
import fs from 'fs-extra';
import inquirer from 'inquirer';
import net from 'net';
import path from 'path';
import { socketPath } from '.';
import { ArchitectError } from '../..';
import BaseCommand from "../../base-command";
import { DockerComposeUtils } from "../../common/docker-compose";
import { RequiresDocker } from '../../common/docker/helper';
import LocalPaths from '../../paths';

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
    // Essentially add a 3 mintue timeout
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

    const socket_path = socketPath(path.join(this.app.config.getConfigDir(), LocalPaths.LOCAL_DEPLOY_PATH, name));
    if (fs.existsSync(socket_path)) {
      const socket = net.createConnection(socket_path);
      socket.write('stop', () => {
        socket.end();
      });
    } else {
      // If there's no socket, dev is running in detached mode and we can stop it with docker compose without
      // working about the health check restarting anything.
      const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), name);
      DockerComposeUtils.dockerCompose(['-p', name, '-f', compose_file, 'stop']);
    }

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
