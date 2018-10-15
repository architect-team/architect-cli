import {Command, flags} from '@oclif/command';
import {execSync} from 'child_process';
import {existsSync, mkdirSync} from 'fs';
import * as path from 'path';

import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';
import SUPPORTED_LANGUAGES from '../common/supported-languages';

export default class Install extends Command {
  static description = 'Install dependencies of the current service';

  static flags = {
    help: flags.help({char: 'h'}),
    recursive: flags.boolean({
      char: 'r',
      description: 'Generate architect dependency files for all services in the dependency tree.'
    })
  };

  static args = [];

  async run() {
    try {
      this.installDependencies(process.cwd());
    } catch (error) {
      this.error(error.message);
    }
  }

  installDependencies(service_path: string) {
    const {flags} = this.parse(Install);
    const service_config = ServiceConfig.loadFromPath(service_path);
    this.log(`Installing dependencies for ${service_config.name}`);

    // Make the folder to store dependency stubs
    const stubs_directory = path.join(service_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY);
    if (!existsSync(stubs_directory)) {
      mkdirSync(stubs_directory);
    }

    // Install all dependencies
    Object.keys(service_config.dependencies).forEach((dependency_name: string) => {
      if (service_config.dependencies.hasOwnProperty(dependency_name)) {
        const dependency_identifier = service_config.dependencies[dependency_name];
        const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(dependency_identifier);
        this.installDependency(dependency_path, stubs_directory, service_config.language);
        if (flags.recursive) {
          this.installDependencies(dependency_path);
        }
      }
    });

    if (service_config.proto) {
      this.installDependency(service_path, stubs_directory, service_config.language);
    }
  }

  installDependency(dependency_path: string, target_path: string, target_language: SUPPORTED_LANGUAGES) {
    const dependency_config = ServiceConfig.loadFromPath(dependency_path);
    if (!dependency_config.proto) {
      throw new Error(`${dependency_config.name} has no .proto file configured.`);
    }

    this.log(`Generating stubs for ${dependency_config.name}`);
    const stub_directory = path.join(target_path, dependency_config.name);
    if (!existsSync(stub_directory)) {
      mkdirSync(stub_directory);
    }

    let protobuf_options: [string, string][] = [];
    let grpc_options: [string, string][] = [];
    protobuf_options.push(['proto_path', dependency_path]);
    grpc_options.push(['proto_path', dependency_path]);
    grpc_options.push(['grpc_out', stub_directory]);
    switch (target_language) {
      case SUPPORTED_LANGUAGES.JAVASCRIPT:
        protobuf_options.push(['js_out', `import_style=commonjs,binary:${stub_directory}`]);
        grpc_options.push(['plugin', 'protoc-gen-grpc=`which grpc_node_plugin`']);
        break;
      case SUPPORTED_LANGUAGES.PYTHON:
        protobuf_options.push(['python_out', stub_directory]);
        grpc_options.push(['plugin', 'protoc-gen-grpc=`which grpc_python_plugin`']);
        break;
      default:
        protobuf_options.push([`${target_language}_out`, stub_directory]);
        throw new Error(`RPC stub generation not supported for ${target_language}`);
    }

    const proto_path = path.join(dependency_path, dependency_config.proto);
    const protobuf_options_string = protobuf_options.map(pair => `--${pair.join('=')}`).join(' ');
    execSync(`protoc ${protobuf_options_string} ${proto_path}`);

    const grpc_options_string = grpc_options.map(pair => `--${pair.join('=')}`).join(' ');
    execSync(`protoc ${grpc_options_string} ${proto_path}`);
  }
}
