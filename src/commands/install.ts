import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import MissingBuildContextError from '../common/errors/missing-build-context';
import { getServiceApiDefinitionContents, parseImageLabel } from '../common/utils/docker';
import { DependencyNode, ServiceConfig, ServiceConfigBuilder, ServiceNode } from '../dependency-manager/src';
import ARCHITECTPATHS from '../paths';

interface ServiceDetails {
  config: ServiceConfig;
  node: DependencyNode;
}

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

  private async genGrpcStubs(source_config: ServiceConfig, source_node: LocalServiceNode, target_dirname: string, definitions_contents: { [filename: string]: string }) {
    const write_path = path.join(source_node.service_path, ARCHITECTPATHS.CODEGEN_DIR);

    // Load definitions to file system
    const tmp_stub_directory = path.join(os.tmpdir(), target_dirname);
    const stub_directory = path.join(write_path, target_dirname);
    fs.ensureDir(tmp_stub_directory);
    await fs.ensureDir(stub_directory);

    switch (source_config.getLanguage()) {
      case 'node':
        try {
          await execa('which', ['grpc_tools_node_protoc']);
        } catch (err) {
          await execa('npm', ['install', '-g', 'grpc-tools']);
        }

        for (const filename of Object.keys(definitions_contents)) {
          const proto_path = path.join(tmp_stub_directory, filename);
          await fs.outputFile(proto_path, definitions_contents[filename]);
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
          const proto_path = path.join(tmp_stub_directory, filename);
          await fs.outputFile(proto_path, definitions_contents[filename]);
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

  private async genClientCode(source: LocalServiceNode, target: ServiceDetails) {
    let target_api_definitions: { [filename: string]: string } = {};

    if (target.node instanceof ServiceNode) {
      target_api_definitions = await parseImageLabel(target.node.image!, 'api_definitions');
    } else if (target.node instanceof LocalServiceNode) {
      target_api_definitions = getServiceApiDefinitionContents(target.node.service_path, target.config);
    }

    if (Object.keys(target_api_definitions).length > 0) {
      const source_config = ServiceConfigBuilder.buildFromPath(source.service_path);

      switch (target.config!.getApiSpec().type) {
        case 'grpc':
          return this.genGrpcStubs(source_config, source, target.config.getName().replace(/-/g, '_'), target_api_definitions);
      }
    }
  }

  async run() {
    const { args, flags } = this.parse(Install);

    let dependency_manager = new LocalDependencyManager(this.app.api);
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

    console.log(dependency_manager.graph);
    console.log('');

    dependency_manager.graph.nodes.forEach(async node => {
      if (node instanceof LocalServiceNode) {
        this.log(`Installing dependencies for ${node.name}`);
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

          // eslint-disable-next-line prefer-const
          let [service_name, service_tag] = args.service_name.split(':');
          if (!service_tag) {
            service_tag = 'latest';
          }

          config.addDependency(service_name, service_tag);
          ServiceConfigBuilder.saveToPath(node.service_path, config);
          const [dep_node, dep_config] = await dependency_manager.loadService(service_name, service_tag);
          this.genClientCode(node, { node: dep_node, config: dep_config });
        } else {
          for (const dependency of dependencies) {
            const [dep_node, dep_config] = await dependency_manager.loadService(dependency.name, dependency.tag);
            this.log(chalk.blue(`Installing ${dep_config.getName()} as dependency of ${config.getName()}`));
            await this.genClientCode(node, { node: dep_node, config: dep_config });
            this.log(chalk.green(`${dep_config.getName()} installed`));
          }
        }
      }
    });
  }
}
