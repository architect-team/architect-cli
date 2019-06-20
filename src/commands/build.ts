import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as execa from 'execa';
import * as Listr from 'listr';
import * as path from 'path';

import Command from '../base';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';

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

    if (flags.recursive) {
      await Install.run(['-p', root_service_path, '-r', '--only_load']);
    } else {
      await Install.run(['-p', root_service_path, '--only_load']);
    }

    const root_service = ServiceDependency.create(this.app_config, root_service_path);
    const dependencies = flags.recursive ? root_service.local_dependencies : [root_service];
    const tasks: Listr.ListrTask[] = [];

    dependencies.forEach(dependency => {
      tasks.push({
        title: `Building docker image for ${_info(dependency.config.full_name)}`,
        task: async () => {
          await this.buildImage(dependency.service_path, dependency.config);
        }
      });
    });
    return tasks;
  }

  async buildImage(service_path: string, service_config: ServiceConfig) {
    const dockerfile_path = path.join(__dirname, '../../Dockerfile');
    const tag_name = `architect-${service_config.full_name}`;

    await execa('docker', [
      'build',
      '--compress',
      '--build-arg', `SERVICE_LANGUAGE=${service_config.language}`,
      '-t', tag_name,
      '-f', dockerfile_path,
      '--label', `architect.json=${JSON.stringify(service_config)}`,
      service_path
    ]);
  }
}
