import chalk from 'chalk';
import BaseCommand from "../base-command";
import { DockerComposeUtils } from "../common/docker-compose";
import { docker } from '../common/docker/cmd';
import { DockerInspect } from '../common/docker-compose/template';
import inquirer from 'inquirer';

export default class KillLocalDeployment extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Kill a local deployment';
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

  async removeContainers(containers: DockerInspect[]): Promise<void> {
    for (const container of containers) {
      let name;
      const config_labels = container.Config.Labels;
      if ('com.docker.compose.service' in config_labels) {
        name = config_labels['com.docker.compose.service'];
      } else {
        name = container.Name;
      }

      const docker_container_name = container.Name.startsWith('/') ? container.Name.substring(1) : container.Name;
      const status = container.State.Status;
      if (status === 'running') {
        try {
          await docker(['stop', `${docker_container_name}`], { stdout: false });
        } catch {
          throw new Error(`Docker failed to stop running container '${name}'.`);
        }
      }

      try {
        await docker(['rm', '-f', `${docker_container_name}`], { stdout: false });
      } catch {
        throw new Error(`Docker failed to remove container '${name}'.`);
      }

      if (config_labels['traefik.enable']) {
        const project_name = config_labels['com.docker.compose.project'];
        const port = config_labels['traefik.port'];
        const container_number = config_labels['com.docker.compose.container-number'];
        const gateway_container_name = `${project_name}-gateway-${port}-${container_number}`;

        const gateway_containers = await docker(['ps', '--filter', `name=${gateway_container_name}`], { stdout: false });
        if (gateway_containers.stdout.includes(gateway_container_name)) {
          try {
            await docker(['rm', '-f', gateway_container_name], { stdout: false });
          } catch {
            throw new Error(`Docker failed to remove gateway container '${gateway_container_name}'.`);
          }
        }
      }
    }

    this.log(chalk.green(`Successfully killed local deployment.`));
  }

  async run(): Promise<void> {
    const { args } = await this.parse(KillLocalDeployment);

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
      throw new Error(chalk.red(`Environment '${args.name}' does not have any running container. Use command 'architect dev:list' to list local deployments.`));
    }

    await this.removeContainers(local_env_map[args.name]);
  }
}
