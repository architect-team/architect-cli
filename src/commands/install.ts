import { flags } from '@oclif/command';
import chalk from 'chalk';
import cli from 'cli-ux';
import crypto from 'crypto';
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
import { ServiceConfigBuilder, ServiceNode } from '../dependency-manager/src';
import ARCHITECTPATHS from '../paths';

export default class Install extends Command {
  auth_required() {
    const { args } = this.parse(Install);
    return args.service_ref;
  }

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
    const output_directory = path.join(node.service_path, ARCHITECTPATHS.CODEGEN_DIR);

    // Evaluate checksum
    const checksum_file = path.join(output_directory, target_dirname, 'checksum');
    const old_checksum_contents = await fs.readFile(checksum_file, 'utf-8').catch(() => undefined);
    const new_checksum_contents = Object.keys(definitions_contents).map(filename =>
      crypto.createHash('md5').update(definitions_contents[filename]).digest('hex')
    ).join('\n');
    if (new_checksum_contents === old_checksum_contents) {
      return;
    }

    // Load definitions to file system
    const tmp_stub_root = path.join(os.tmpdir(), 'architect-grpc');
    const tmp_stub_directory = path.join(tmp_stub_root, target_dirname);
    await fs.ensureDir(tmp_stub_directory);
    await fs.ensureDir(output_directory);

    switch (node.service_config.getLanguage()) {
      case 'node':
        try {
          await execa('which', ['grpc_tools_node_protoc']);
        } catch (err) {
          await execa('npm', ['install', '-g', 'grpc-tools']);
        }

        for (const filename of Object.keys(definitions_contents)) {
          const proto_path = path.join(tmp_stub_directory, filename);
          await fs.writeFile(proto_path, definitions_contents[filename]);
          await execa('grpc_tools_node_protoc', [
            '-I', tmp_stub_root,
            `--js_out=import_style=commonjs,binary:${output_directory}`,
            `--grpc_out=${output_directory}`,
            proto_path,
          ]);
        }

        fs.removeSync(tmp_stub_directory);
        break;

      case 'python':
        let python = 'python3';
        let pip = 'pip3';
        try {
          await execa('which', ['python3']);
        } catch {
          python = 'python';
          pip = 'pip';
        }

        try {
          await execa(python, ['-c', '"import grpc_tools"'], { shell: true });
        } catch {
          await execa(pip, ['install', 'grpcio-tools']);
        }

        for (const filename of Object.keys(definitions_contents)) {
          const proto_path = path.join(tmp_stub_directory, filename);
          await fs.outputFile(proto_path, definitions_contents[filename]);
          await execa(python, [
            '-m', 'grpc_tools.protoc',
            '-I', tmp_stub_root,
            `--python_out=${output_directory}`,
            `--grpc_python_out=${output_directory}`,
            proto_path,
          ]);
        }

        fs.removeSync(tmp_stub_directory);

        fs.writeFileSync(path.join(output_directory, '__init__.py'), '');
        target_dirname.split('/').forEach((_, index) => {
          const joiner = Array(index).fill('..').join('/');
          fs.writeFileSync(path.join(output_directory, target_dirname, joiner, '__init__.py'), '');
        });
        break;

      default:
        throw new Error(`The CLI doesn't currently support GRPC for ${node.service_config.getLanguage()}`);
    }

    fs.writeFileSync(checksum_file, new_checksum_contents);
  }

  private async genClientCode(source: LocalServiceNode, target: ServiceNode) {
    let target_api_definitions: { [filename: string]: string } = {};

    if (target instanceof LocalServiceNode) {
      target_api_definitions = getServiceApiDefinitionContents(target.service_path, target.service_config);
    } else {
      target_api_definitions = await parseImageLabel(target.image, 'api_definitions');
    }

    if (Object.keys(target_api_definitions).length > 0) {
      switch (target.api.type) {
        case 'grpc':
          return this.genGrpcStubs(source, target.env_ref.replace(/-/g, '_'), target_api_definitions);
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

    for (const node of dependency_manager.graph.nodes) {
      // Dependencies can only be installed on local nodes
      if (node instanceof LocalServiceNode) {
        this.log(chalk.blue(`Installing dependencies for ${node.ref}`));
        const config = ServiceConfigBuilder.buildFromPath(node.service_path);

        // Install a single new dependency
        if (args.service_ref) {
          if (args.service_ref.includes(node.ref)) {
            throw new Error('A service cannot be a dependency for itself');
          } else if (Object.keys(config.getDependencies()).find(dep_name => args.service_ref.includes(dep_name))) {
            this.warn(`${args.service_ref.split(':')[0]} is already installed for ${node.ref}. Skipping.`);
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
            if (dep_node instanceof ServiceNode) {
              cli.action.start(chalk.grey(`-- Generating client code for ${dep_node.ref}`), undefined, { stdout: true });
              await this.genClientCode(node, dep_node);
              cli.action.stop(chalk.grey('done'));
            }
          }
        }
      }
    }
  }
}
