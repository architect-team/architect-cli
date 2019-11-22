import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import untildify from 'untildify';
import path from 'path';
import fs from 'fs-extra';

import Command from '../base-command';
import ProtocExecutor from '../common/protoc-executor';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { EnvironmentConfigBuilder, ServiceConfigBuilder, DependencyNode, ServiceNode, ServiceConfig } from '../dependency-manager/src';
import MissingBuildContextError from '../common/errors/missing-build-context';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import { parseImageLabel, getServiceApiDefinitionContents } from '../common/utils/docker';

declare const process: NodeJS.Process;

export default class Install extends Command {
  static description = 'Install services and generate the corresponding client libraries';

  static args = [{
    name: 'service_ref',
    description: 'Name of or path to the service to install',
    required: false,
  }];

  static flags = {
    ...Command.flags,
    services: flags.string({
      char: 's',
      description: 'Path to a service to build',
      exclusive: ['environment'],
      multiple: true,
    }),
    environment: flags.string({
      char: 'e',
      description: 'Path to an environment config including local services to build',
      exclusive: ['service'],
    }),
  };

  private async genGrpcStubs(source_config: ServiceConfig, source_node: LocalServiceNode, definitions_contents: { [filename: string]: string }) {
    const write_path = path.join(source_node.service_path, 'architect_services');

    switch (source_config.getLanguage()) {
      case 'node':
        try {
          await execa('which', ['grpc_tools_node_protoc']);
        } catch (err) {
          await execa('npm', ['install', '-g', 'grpc-tools']);
        }

        for (const filename of Object.keys(definitions_contents)) {
          const proto_path = path.join(target_service_path, filename);
          fs.ensureDirSync(write_path);
          await execa('grpc_tools_node_protoc', [
            '-I', path.dirname(filename),
            `--js_out=import_style=commonjs,binary:${write_path}`,
            `--grpc_out=${write_path}`,
            proto_path,
          ]);
        }
        break;

      case 'python':
        try {
          await execa('python3', ['-c', '"import grpc_tools"']);
        } catch (err) {
          await execa('pip3', ['install', 'grpcio-tools']);
        }

        for (const filename of Object.keys(definitions_contents)) {
          const proto_path = path.join(target_service_path, filename);
          fs.ensureDirSync(write_path);
          await execa('python3', [
            '-m', 'grpc_tools.protoc',
            '-I', path.dirname(filename),
            `--python_out=${write_path}`,
            `--grpc_python_out=${write_path}`,
            proto_path,
          ]);
        }
        break;

      default:
        throw new Error(`The CLI doesn't currently support GRPC for ${source_config.getLanguage()}`);
    }
  }

  private async genClientCode(source: LocalServiceNode, target: DependencyNode) {
    let target_api_definitions: { [filename: string]: string } = {};
    let target_config: ServiceConfig;

    if (target instanceof ServiceNode) {
      target_api_definitions = await parseImageLabel(target.image!, 'api_definitions');
      const plain_config = await parseImageLabel(target.image!, 'architect.json');
      target_config = ServiceConfigBuilder.buildFromJSON(plain_config);
    } else if (target instanceof LocalServiceNode) {
      target_config = ServiceConfigBuilder.buildFromPath(target.service_path);
      target_api_definitions = getServiceApiDefinitionContents(target.service_path, target_config);
    }

    if (Object.keys(target_api_definitions).length > 0) {
      const source_config = ServiceConfigBuilder.buildFromPath(source.service_path);

      switch (target_config!.getApiSpec().type) {
        case 'grpc':
          return this.genGrpcStubs(source_config, source, target_api_definitions);
      }
    }
  }

  async run() {
    const { args, flags } = this.parse(Install);

    let dependency_manager = new LocalDependencyManager(this.app.api, EnvironmentConfigBuilder.buildFromJSON({}));
    if (flags.environment) {
      const config_path = path.resolve(untildify(flags.environment));
      dependency_manager = await LocalDependencyManager.createFromPath(this.app.api, config_path);
    } else if (flags.services) {
      for (let service_path of flags.services) {
        service_path = path.resolve(untildify(service_path));
        const [node, config] = await dependency_manager.loadLocalService(service_path);
        await dependency_manager.loadDependencies(node, config, false);
      }
    } else if (!args.service_ref) {
      throw new MissingBuildContextError();
    }

    dependency_manager.graph.nodes.forEach(async node => {
      if (node instanceof LocalServiceNode) {
        const config = ServiceConfigBuilder.buildFromPath(node.service_path);
        const dependencies = dependency_manager.graph.getNodeDependencies(node);

        // Install a single new dependency
        if (args.service_ref) {
          if (args.service_ref.includes(node.name)) {
            throw new Error('A service cannot be a dependency for itself');
          } else if (dependencies.find(dep => args.service_ref.includes(dep.name))) {
            this.warn(`${args.service_ref.split(':')[0]} is already installed for ${node.name}. Skipping.`);
            return;
          }

          let [service_name, service_tag] = args.service_name.split(':');
          if (!service_tag) {
            service_tag = 'latest';
          }

          config.addDependency(service_name, service_tag);
          ServiceConfigBuilder.saveToPath(node.service_path, config);
          const [dep_node] = await dependency_manager.loadService(service_name, service_tag);
          this.genClientCode(node, dep_node);
        } else {
          dependency_manager.graph.getNodeDependencies(node).forEach(async dependency => {
            if (args.service_name === dependency) {

            }
          });
        }


      }
    });



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
