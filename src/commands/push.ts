import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import execa from 'execa';
import Command from '../base-command';
import EnvironmentConfigV1 from '../common/environment-config/v1';
import generateGraphFromPaths from '../common/local-graph/generator';
import LocalServiceNode from '../common/local-graph/nodes/local-service';
import { DatastoreNode, DependencyNode } from '../dependency-graph/src';
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

    const dependencies = await generateGraphFromPaths([process.cwd()], new EnvironmentConfigV1(), this.app.api);
    const dependencyArray = Array.from(dependencies.nodes.values());
    const dependencies_to_push = flags.recursive ? dependencyArray : [dependencyArray[0]];

    const local_service_nodes = dependencyArray.filter(node => node instanceof LocalServiceNode);
    if (local_service_nodes.length > 1) { //current service is a LocalServiceDependency
      throw new Error('Cannot push image with local dependencies');
    }

    const tasks: Promise<void>[] = [];
    for (const dependency of dependencies_to_push) {
      if (!(dependency instanceof DatastoreNode)) {
        tasks.push(
          (async () => {
            await this.pushImage(dependency);
            cli.action.stop(chalk.green(`Successfully pushed Docker image for ${dependency.name}`));
          })());
      }
    };
    await Promise.all(tasks);
  }

  async pushImage(service: DependencyNode) {
    const { flags } = this.parse(Push);
    const tag = flags.tag || 'latest';
    const full_tag = `${this.app.config.registry_host}/${service.name}:${tag}`;
    cli.action.start(chalk.blue(`Pushing Docker image for ${full_tag}`));
    return execa('docker', ['push', full_tag]);
  }
}
