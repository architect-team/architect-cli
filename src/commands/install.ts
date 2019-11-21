import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import url from 'url';
import Command from '../base-command';
import EnvironmentConfigV1 from '../common/environment-config/v1';
import generateGraphFromPaths from '../common/local-graph/generator';
import LocalServiceNode from '../common/local-graph/nodes/local-service';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';
import DependencyGraph, { DatastoreNode } from '../dependency-graph/src';

declare const process: NodeJS.Process;

export default class Install extends Command {
  static description = 'Install services and generate the corresponding client libraries';

  static args = [{
    name: 'service_name',
    description: 'Name of or path to the service to install',
    required: false,
  }];

  static flags = {
    ...Command.flags,
    prefix: flags.string({
      char: 'p',
      description: 'Path prefix indicating where the install command should execute from',
    }),
    service: flags.string({
      char: 's',
      description: 'Path to services to generate client code for',
      multiple: true,
      exclusive: ['service_name'],
    }),
    recursive: flags.boolean({
      char: 'r',
      description: 'Recursively generates required client code for downstream dependencies',
      default: false,
      exclusive: ['service_name'],
    }),
  };

  async run() {
    await this.tasks();
  }

  async tasks() {
    const { args, flags } = this.parse(Install);
    const root_service_path = flags.prefix ? flags.prefix : process.cwd();
    const dependency_graph = await generateGraphFromPaths([process.cwd()], new EnvironmentConfigV1(), this.app.api);
    const root_service = Array.from(dependency_graph.nodes.values())[0];

    if (args.service_name) {
      // eslint-disable-next-line prefer-const
      let [service_name, service_version] = args.service_name.split(':');
      if (!service_version) {
        throw new Error(`Please specify a version for ${service_name}`);
      }
      if (root_service.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      const new_dependencies: { [s: string]: string } = {};
      if (new_dependencies[service_name]) {
        throw new Error(`A version of ${service_name} is already installed.`);
      }

      cli.action.start(chalk.blue(`Installing ${args.service_name} as dependency of ${root_service.name}`), undefined, { stdout: true });
      new_dependencies[service_name] = service_version;
      const config = ServiceConfig.loadFromPath(root_service_path);
      const all_dependencies = Object.assign({}, config.dependencies, new_dependencies);
      config.setDependencies(all_dependencies);
      const api_definitions_contents = await this.get_remote_definitions(args.service_name);
      if (!api_definitions_contents) {
        throw new Error(`No api definitions found for ${service_name}`);
      }
      await ProtocExecutor.execute((root_service as LocalServiceNode), undefined, { api_definitions_contents, service_name });
      ServiceConfig.saveToPath(root_service_path, config);
      cli.action.stop(chalk.green(`${args.service_name} installed`));
    } else {
      await this.installServices((root_service as LocalServiceNode), dependency_graph, flags.recursive);
    }
  }

  async get_remote_definitions(remote_service_version: string) {
    const repository_name = url.resolve(`${this.app.config.registry_host}/`, `${remote_service_version}`);

    let config;
    try {
      config = await this.load_service_config(repository_name);
    } catch {
      await execa('docker', ['pull', repository_name]);
      config = await this.load_service_config(repository_name);
    }
    return config;
  }

  async load_service_config(repository_name: string) {
    const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "architect.json"}}']);
    const config = JSON.parse(stdout);
    if (config.api) {
      const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "api_definitions"}}']);
      return JSON.parse(stdout);
    }
  }

  async installServices(root_dependency: LocalServiceNode, all_dependencies: DependencyGraph, recursive: boolean) {
    const service_dependencies = [root_dependency];
    const _seen = [];
    while (service_dependencies.length) {
      const target_dependency = service_dependencies.pop();
      _seen.push(target_dependency!.name);

      cli.action.start(chalk.blue(`Installing ${target_dependency!.name}`), undefined, { stdout: true });
      await ProtocExecutor.execute(target_dependency!, (target_dependency as LocalServiceNode));
      cli.action.stop(chalk.green(`${target_dependency!.name} installed`));

      const directDependencies = all_dependencies.getNodeDependencies(target_dependency!);
      for (const dependency of directDependencies) {
        if (!(dependency instanceof DatastoreNode)) {
          cli.action.start(chalk.blue(`Installing ${dependency.name} as dependency of ${target_dependency!.name}`), undefined, { stdout: true });
          await ProtocExecutor.execute(target_dependency!, (dependency as LocalServiceNode));
          cli.action.stop(chalk.green(`${dependency.name} installed`));
          if (recursive && !_seen.includes(dependency.name)) {
            service_dependencies.push(dependency as LocalServiceNode);
          }
        }
      }
    }
  }
}
