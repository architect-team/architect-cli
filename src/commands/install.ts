import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import execa from 'execa';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import MissingContextError from '../common/errors/missing-build-context';
import { getServiceApiDefinitionContents, parseImageLabel } from '../common/utils/docker';
import { DependencyNode, ServiceConfigBuilder, ServiceNode } from '../dependency-manager/src';
import ARCHITECTPATHS from '../paths';

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

  private async genGrpcStubs(node: LocalServiceNode, target_dirname: string, definitions_contents: { [filename: string]: string }) {
    const write_path = path.join(node.service_path, ARCHITECTPATHS.CODEGEN_DIR);

    // Load definitions to file system
    const tmp_stub_directory = path.join(os.tmpdir(), target_dirname);
    const stub_directory = path.join(write_path, target_dirname);
    fs.ensureDir(tmp_stub_directory);
    await fs.ensureDir(stub_directory);

    switch (node.service_config.getLanguage()) {
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
            '-I', tmp_stub_directory,
            `--js_out=import_style=commonjs,binary:${stub_directory}`,
            `--grpc_out=${stub_directory}`,
            proto_path,
          ]);
        }

        fs.removeSync(tmp_stub_directory);
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
            '-I', tmp_stub_directory,
            `--python_out=${write_path}`,
            `--grpc_python_out=${write_path}`,
            proto_path,
          ]);
        }

        fs.removeSync(tmp_stub_directory);
        break;

      default:
        throw new Error(`The CLI doesn't currently support GRPC for ${node.service_config.getLanguage()}`);
    }
  }

  private async genClientCode(source: LocalServiceNode, target: DependencyNode) {
    let target_api_definitions: { [filename: string]: string } = {};

    if (target instanceof ServiceNode) {
      target_api_definitions = await parseImageLabel(target.image!, 'api_definitions');
    } else if (target instanceof LocalServiceNode) {
      target_api_definitions = getServiceApiDefinitionContents(target.service_path, target.service_config);
    }

    if (Object.keys(target_api_definitions).length > 0) {
      const source_config = ServiceConfigBuilder.buildFromPath(source.service_path);

      switch (target.service_config!.getApiSpec().type) {
        case 'grpc':
          return this.genGrpcStubs(source, target.name.replace(/-/g, '_'), target_api_definitions);
      }
    }
  }

  async run() {
    const { args, flags } = this.parse(Install);

    if (!args.service_ref && !flags.environment && !flags.services) {
      throw new MissingContextError();
    }

    let dependency_manager = new LocalDependencyManager(this.app.api);
    if (flags.environment) {
      const config_path = path.resolve(untildify(flags.environment));
      dependency_manager = await LocalDependencyManager.createFromPath(this.app.api, config_path);
    } else if (flags.services) {
      for (let service_path of flags.services) {
        service_path = path.resolve(untildify(service_path));
        const node = await dependency_manager.loadLocalService(service_path);

        if (!args.service_ref) {
          await dependency_manager.loadDependencies(node, false);
        }
      }
    } else {
      // Use current path as service context
      const node = await dependency_manager.loadLocalService(process.cwd());

      if (!args.service_ref) {
        await dependency_manager.loadDependencies(node, false);
      }
    }

    for (const node of dependency_manager.graph.nodes.values()) {
      // Dependencies can only be installed on local nodes
      if (node instanceof LocalServiceNode) {
        this.log(chalk.blue(`Installing dependencies for ${node.name}`));
        const config = ServiceConfigBuilder.buildFromPath(node.service_path);

        // Install a single new dependency
        if (args.service_ref) {
          if (args.service_ref.includes(node.name)) {
            throw new Error('A service cannot be a dependency for itself');
          } else if (Object.keys(config.getDependencies()).find(dep_name => args.service_ref.includes(dep_name))) {
            this.warn(`${args.service_ref.split(':')[0]} is already installed for ${node.name}. Skipping.`);
            return;
          }

          // eslint-disable-next-line prefer-const
          let [service_name, service_tag] = args.service_ref.split(':');
          if (!service_tag) {
            service_tag = 'latest';
          }

          cli.action.start(chalk.grey(`-- Installing ${service_name} as dependency of ${config.getName()}`), undefined, { stdout: true });
          config.addDependency(service_name, service_tag);
          ServiceConfigBuilder.saveToPath(node.service_path, config);
          const dep_node = await dependency_manager.loadService(service_name, service_tag);
          this.genClientCode(node, dep_node);
          cli.action.stop(chalk.grey('done'));
        } else {
          const dependencies = dependency_manager.graph.getNodeDependencies(node);
          dependencies.push(node);
          for (const dep_node of dependencies) {
            if (dep_node instanceof ServiceNode || dep_node instanceof LocalServiceNode) {
              cli.action.start(chalk.grey(`-- Generating client code for ${dep_node.name}`), undefined, { stdout: true });
              await this.genClientCode(node, dep_node);
              cli.action.stop(chalk.grey('done'));
            }
          }
        }
      }
    }
  }
}
