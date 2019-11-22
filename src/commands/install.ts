import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
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
    const { args, flags } = this.parse(Install);
    const root_service_paths = flags.service ? flags.service : [process.cwd()];

    for (const root_service_path of root_service_paths) {
      const root_dependency_graph = await generateGraphFromPaths([root_service_path], new EnvironmentConfigV1(), this.app.api, false);
      const all_dependencies_graph = await generateGraphFromPaths([root_service_path], new EnvironmentConfigV1(), this.app.api);
      const root_service = Array.from(root_dependency_graph.nodes.values())[0];

      if (args.service_name) {
        // eslint-disable-next-line prefer-const
        let [service_name, service_version] = args.service_name.split(':');
        if (!service_version) {
          service_version = 'latest';
        }
        if (root_service.name === service_name) {
          throw new Error('Cannot install a service inside its own config');
        }
        const full_service_name = `${service_name}:${service_version}`;

        const new_dependencies: { [s: string]: string } = {};
        if (Array.from(all_dependencies_graph.getNodeDependencies(root_service)).filter(node => node.name.split(':')[0] === service_name).length) {
          throw new Error(`A version of ${service_name} is already installed.`);
        }

        cli.action.start(chalk.blue(`Installing ${args.service_name} as dependency of ${root_service.name}`), undefined, { stdout: true });
        new_dependencies[service_name] = service_version;
        const config = ServiceConfig.loadFromPath(root_service_path);
        const all_dependencies = Object.assign({}, config.dependencies, new_dependencies);
        config.setDependencies(all_dependencies);
        const api_definitions_contents = await this.get_remote_definitions(full_service_name, 'api_definitions');
        if (!api_definitions_contents) {
          throw new Error(`No api definitions found for ${service_name}`);
        }
        await ProtocExecutor.execute((root_service as LocalServiceNode), undefined, {
          api_definitions_contents,
          service_name,
          language: (await this.get_remote_definitions(full_service_name, 'architect.json')).language
        });
        ServiceConfig.saveToPath(root_service_path, config);
        cli.action.stop(chalk.green(`${args.service_name} installed`));
      } else {
        await this.installServices(all_dependencies_graph);
      }
    }
  }

  async get_remote_definitions(remote_service_version: string, docker_label: string) {
    const [service_name, tag] = remote_service_version.split(':');
    const { data: service } = await this.app.api.get(`/services/${service_name}`);
    const repository_url = service.url.replace(/(^\w+:|^)\/\//, ''); // strips the protocol from the URL
    const repository_name = `${repository_url}:${tag}`;

    let config;
    try {
      config = await this.load_service_config(repository_name, docker_label);
    } catch {
      await execa('docker', ['pull', repository_name]);
      config = await this.load_service_config(repository_name, docker_label);
    }
    return config;
  }

  async load_service_config(repository_name: string, docker_label: string) {
    const { stdout } = await execa('docker', ['inspect', repository_name, '--format', `{{ index .Config.Labels "${docker_label}"}}`]);
    return JSON.parse(stdout);
  }

  async installServices(dependency_graph: DependencyGraph) {

    for (const node of dependency_graph.nodes.values()) {
      const target_dependency = node as LocalServiceNode;

      if (target_dependency.api && target_dependency.api.type === 'grpc') {
        cli.action.start(chalk.blue(`Installing ${target_dependency!.name}`), undefined, { stdout: true });
        await ProtocExecutor.execute(target_dependency!, target_dependency);
        cli.action.stop(chalk.green(`${target_dependency!.name} installed`));
      }

      const directDependencies = dependency_graph.getNodeDependencies(target_dependency!);
      for (const dependency of directDependencies) {
        const local_dependency = dependency as LocalServiceNode;

        if (!(dependency instanceof DatastoreNode) && local_dependency.api && local_dependency.api.type === 'grpc') {
          cli.action.start(chalk.blue(`Installing ${dependency.name} as dependency of ${target_dependency!.name}`), undefined, { stdout: true });
          await ProtocExecutor.execute(target_dependency!, local_dependency);
          cli.action.stop(chalk.green(`${dependency.name} installed`));
        }
      }
    }
  }
}
