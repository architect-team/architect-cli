import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import Command from '../base-command';
import DependencyNode from '../common/dependency-manager/node';
import { LocalDependencyNode } from '../common/dependency-manager/node/local';
import { genFromLocalPaths } from '../common/utils/dependency';
import Build from './build';

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
  };

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build',
    },
  ];

  async run() {
    const { args, flags } = this.parse(Push);
    const root_service_path = args.context ? args.context : process.cwd();

    const build_args = ['-s', root_service_path];
    if (flags.recursive) build_args.push('-r');
    if (flags._local) build_args.push('--_local');
    if (flags.tag) { build_args.push('-t'); build_args.push(flags.tag); }
    await Build.run(build_args);

    const dependencies = await genFromLocalPaths([process.cwd()], undefined, flags.recursive);
    const tasks: Promise<void>[] = [];
    dependencies.nodes.forEach(dependency => {
      if (!dependency.isDatastore || (!dependency.isDatastore && (dependency as LocalDependencyNode).service_path)) {
        tasks.push(
          (async () => {
            await this.pushImage(dependency);
            console.log(chalk.green(`Successfully pushed Docker image for ${dependency.name}`));
          })());
      }
    });
    await Promise.all(tasks);
  }

  async pushImage(service: DependencyNode): Promise<void> {
    const { flags } = this.parse(Push);
    const tag = flags.tag || 'latest';
    const full_tag = `${this.app.config.registry_host}/${service.name}:${tag}`;
    console.log(chalk.blue(`Pushing Docker image for ${full_tag}`));
    return execa('docker', ['push', full_tag]);
  }
}
