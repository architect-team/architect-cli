import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as execa from 'execa';
import * as Listr from 'listr';
import * as path from 'path';

import Command from '../base';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';

import Install from './install';

const _info = chalk.blue;

export default class Build extends Command {
  static description = `Create an ${MANAGED_PATHS.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({ char: 'h' }),
    recursive: flags.boolean({
      char: 'r',
      default: false,
      description: 'Whether or not to build images for the cited dependencies'
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose log output'
    })
  };

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build'
    }
  ];

  async run() {
    const { flags } = this.parse(Build);
    const renderer = flags.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(), { concurrent: 2, renderer });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Build);
    let root_service_path = process.cwd();
    if (args.context) {
      root_service_path = path.resolve(args.context);
    }

    const dependencies = await ServiceConfig.getDependencies(root_service_path, flags.recursive);
    const tasks: Listr.ListrTask[] = [];

    dependencies.forEach(dependency => {
      tasks.push({
        title: `Building docker image for ${_info(dependency.service_config.full_name)}`,
        task: async () => {
          const install_tasks = await Install.tasks(['-p', dependency.service_path]);
          const build_task = {
            title: 'Building',
            task: async () => {
              await this.buildImage(dependency.service_path, dependency.service_config);
            }
          };
          return new Listr(install_tasks.concat([build_task]));
        }
      });
    });
    return tasks;
  }

  async buildImage(service_path: string, service_config: ServiceConfig) {
    const dockerfile_path = path.join(__dirname, '../../Dockerfile');
    const tag_name = `architect-${service_config.full_name}`;

    await execa.shell([
      'docker', 'build',
      '--compress',
      '--build-arg', `SERVICE_LANGUAGE=${service_config.language}`,
      '-t', tag_name,
      '-f', dockerfile_path,
      '--label', `architect.json='${JSON.stringify(service_config)}'`,
      service_path
    ].join(' '));
  }
}
