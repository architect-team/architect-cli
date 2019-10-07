import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import Listr from 'listr';
import Command from '../base';
import MANAGED_PATHS from '../common/managed-paths';
import ServiceDependency from '../common/service-dependency';
import Install from './install';

const _info = chalk.blue;
export default class Build extends Command {
  static description = `Create an ${MANAGED_PATHS.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({ char: 'h' }),
    tag: flags.string({
      char: 't',
      description: 'Tag for the architect image',
      exclusive: ['recursive'],
    }),
    recursive: flags.boolean({
      char: 'r',
      default: false,
      description: 'Whether or not to build images for the cited dependencies',
      exclusive: ['tag'],
    }),
    _local: flags.boolean({
      default: false,
      hidden: true,
      description: 'Debug flag to build service and replace local dependencies (file:) with the appropriate version',
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose log output',
    }),
  };

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build',
    },
  ];

  async run() {
    const { flags } = this.parse(Build);
    const renderer = flags.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(), { concurrent: 2, renderer });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Build);
    const root_service_path = args.context ? args.context : process.cwd();

    if (flags.recursive) {
      await Install.run(['-p', root_service_path, '-r']);
    } else {
      await Install.run(['-p', root_service_path]);
    }

    const root_service = ServiceDependency.create(this.app_config, root_service_path);
    const dependencies = flags.recursive ? root_service.local_dependencies : [root_service];
    const tasks: Listr.ListrTask[] = [];

    dependencies.forEach(dependency => {
      tasks.push({
        title: `Building docker image for ${_info(dependency.display_tag(flags.tag))}`,
        task: async () => {
          await this.buildImage(dependency);
        },
      });
    });
    return tasks;
  }

  async buildImage(service: ServiceDependency) {
    const { flags } = this.parse(Build);
    const service_config = JSON.parse(JSON.stringify(service.config));

    if (flags._local) {
      const dependency_map = service.local_dependencies.reduce((map: any, obj) => {
        map[obj.config.name] = obj;
        return map;
      }, {});
      for (const dependency_name of Object.keys(service_config.dependencies)) {
        const sub_dependency = dependency_map[dependency_name];
        if (sub_dependency) {
          service_config.dependencies[dependency_name] = sub_dependency.config.version;
        }
      }
    }

    await execa('docker', [
      'build',
      '--compress',
      '--build-arg', `SERVICE_LANGUAGE=${service_config.language}`,
      '-t', service.tag(flags.tag),
      '--label', `architect.json=${JSON.stringify(service_config)}`,
      '--label', `api_definitions=${JSON.stringify(service.api_definitions)}`,
      service.service_path,
    ]);
  }
}
