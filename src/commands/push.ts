import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import Listr from 'listr';
import Command from '../base-command';
import ServiceDependency from '../common/service-dependency';
import Build from './build';

const _info = chalk.blue;

export default class Push extends Command {
  static description = 'Push service(s) to a registry';

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
    const { flags } = this.parse(Push);
    const renderer = flags.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(), { concurrent: 2, renderer });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Push);
    const root_service_path = args.context ? args.context : process.cwd();

    const build_args = ['-s', root_service_path];
    if (flags.recursive) build_args.push('-r');
    if (flags._local) build_args.push('--_local');
    if (flags.tag) { build_args.push('-t'); build_args.push(flags.tag); }
    await Build.run(build_args);

    const root_service = ServiceDependency.create(this.app.config, root_service_path);
    const dependencies = flags.recursive ? root_service.local_dependencies : [root_service];
    const tasks = [];
    for (const dependency of dependencies) {
      await dependency.load();
      tasks.push({
        title: `Pushing docker image for ${_info(`${dependency.display_tag(flags.tag)}`)}`,
        task: async () => {
          if (!flags._local && dependency.dependencies.some(d => d.local)) {
            throw new Error('Cannot push image with local dependencies');
          } else {
            return this.pushImage(dependency);
          }
        },
      });
    }
    return tasks;
  }

  async pushImage(service: ServiceDependency) {
    const { flags } = this.parse(Push);
    await execa('docker', ['push', service.tag(flags.tag || 'latest')], { stdio: 'ignore' });
  }
}
