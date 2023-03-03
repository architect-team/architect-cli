import { Flags, Interfaces } from '@oclif/core';
import BaseCommand from '../../base-command';
import { DockerComposeUtils } from '../../common/docker-compose';
import { RequiresDocker } from '../../common/docker/helper';
import { EnvironmentUtils } from '../../architect/environment/environment.utils';
import inquirer from 'inquirer';
import chalk from 'chalk';

export default class DevRestart extends BaseCommand {
  async auth_required(): Promise<boolean> {
    return false;
  }

  static description = 'Restart or rebuild a running service';
  static examples = [
    'architect dev:restart',
    'architect dev:restart --build=false hello-world.services.api',
    'architect dev:restart hello-world.services.api hello-world.services.app',
  ];

  static flags = {
    ...EnvironmentUtils.flags,
    build: Flags.boolean({
      char: 'b',
      description: 'Rebuild the services image before restarting (defaults to true)',
      default: true,
    }),
  };

  static args = [{
    sensitive: false,
    name: 'services',
    description: 'Name of the service(s) to restart',
    required: false,
  }];

  // overrides the oclif default parse to allow for args.services to be a list of services
  async parse<F, A extends {
    [name: string]: any;
  }>(options?: Interfaces.Input<F, A>, argv = this.argv): Promise<Interfaces.ParserOutput<F, A>> {
    if (!options) {
      return super.parse(options, argv);
    }
    options.args = [];
    for (const _ of argv) {
      options.args.push({ name: 'filler' });
    }
    const parsed = await super.parse(options, argv) as Interfaces.ParserOutput<F, A>;
    if (parsed.argv.length > 0) {
      parsed.args.services = parsed.argv;
    } else {
      parsed.args.services = [];
    }
    return parsed;
  }

  @RequiresDocker({ compose: true })
  async run(): Promise<void> {
    // eslint-disable-next-line unicorn/prefer-module
    inquirer.registerPrompt('autocomplete', require('inquirer-autocomplete-prompt'));

    const { args, flags } = await this.parse(DevRestart);

    const environment_name = await DockerComposeUtils.getLocalEnvironment(this.app.config.getConfigDir(), flags.environment);
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), environment_name);

    // Convert service names to their resource name used by docker compose
    const compose_services = [];
    if (args.services.length > 0) {
      for (const service_name of args.services) {
        // Handles validating that the service supplied exists in the compose file -- throws an error if invalid
        const service = await DockerComposeUtils.getLocalServiceForEnvironment(compose_file, service_name);
        compose_services.push(service.name);
      }
    } else {
      const service = await DockerComposeUtils.getLocalServiceForEnvironment(compose_file);
      compose_services.push(service.name);
    }

    let compose_args;
    if (flags.build) {
      compose_args = ['-f', compose_file, '-p', environment_name, 'up', '--build', '--force-recreate', '--detach', ...compose_services];
    } else {
      compose_args = ['-f', compose_file, '-p', environment_name, 'restart', ...compose_services];
    }

    await DockerComposeUtils.dockerCompose(compose_args, { stdio: 'inherit' });
    this.log(chalk.green(`Finished ${flags.build ? 'rebuilding' : 'restarting'}.`));
  }
}
