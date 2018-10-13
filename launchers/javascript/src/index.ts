import {Command, flags} from '@oclif/command';
import * as fs from 'fs';
import grpc from 'grpc';
import * as path from 'path';

import DeploymentConfig from './deployment-config';
import MANAGED_PATHS from './managed-paths';
import ServiceConfig from './service-config';

const _removeFileExt = (filename: string): string => filename.slice(0, filename.lastIndexOf('.'));

export default class ArchitectJavascriptLauncher extends Command {
  static description = 'Launches instances of architect services written in javascript';

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    service_path: flags.string({
      char: 's',
      description: 'Local path of the service to launch',
      required: true,
    }),
    config_path: flags.string({
      char: 'c',
      description: 'Local path of the configuration file containing dependency details',
      required: true,
    }),
    target_port: flags.integer({
      char: 'p',
      description: 'Port to run the service on',
      required: true,
    })
  };

  async run() {
    const {flags} = this.parse(ArchitectJavascriptLauncher);
    if (!fs.existsSync(flags.config_path)) {
      throw new TypeError(`Invalid config path: ${flags.config_path}`);
    }

    const deployment_config = require(flags.config_path);
    const target_port = flags.target_port;
    const service_path = flags.service_path;
    const service_config = ServiceConfig.loadFromPath(service_path);
    const stubs_path = path.join(service_path, MANAGED_PATHS.DEPENDENCY_STUBS_DIRECTORY);

    const module_path = path.join(service_path, service_config.main);
    if (!fs.existsSync(module_path)) {
      throw new MainFileError(module_path, service_config.name);
    }

    const module = require(module_path);
    let module_args: DependencyStubs[] = [];
    if (module.hasOwnProperty('dependencies')) {
      module_args = this.generateServiceArgs(service_config, deployment_config, stubs_path, module.dependencies);
    }

    if (service_config.proto) {
      const proto_filename = _removeFileExt(service_config.proto);
      const service_stubs_path = path.join(stubs_path, service_config.name);
      if (!fs.existsSync(service_stubs_path)) {
        throw new DependencyInstallError(service_config.name, service_config.name);
      }
      const grpc_service_details = require(path.join(service_stubs_path, `${proto_filename}_grpc_pb.js`));
      const service_init = grpc_service_details.SnappiService;

      let server = new grpc.Server();
      server.addService(service_init, module(...module_args));
      server.bind(`0.0.0.0:${target_port}`, grpc.ServerCredentials.createInsecure());
      server.start();
      this.log(`${service_config.name} running on port: ${target_port}`);
      this.exit();
    } else {
      delete deployment_config[service_config.name];
      module(...module_args);
    }
  }

  generateServiceArgs(
    service_config: ServiceConfig,
    deployment_config: DeploymentConfig,
    stubs_path: string,
    dependencies: string[]
  ): DependencyStubs[] {
    return dependencies.map((dependency_name: string) => {
      if (!deployment_config.hasOwnProperty(dependency_name)) {
        throw new DependencyInitializationError(dependency_name, service_config.name);
      }

      const dependency_stubs_path = path.join(stubs_path, dependency_name);
      if (!fs.existsSync(dependency_stubs_path)) {
        throw new DependencyInstallError(dependency_name, service_config.name);
      }

      const dependency_environment = deployment_config[dependency_name];

      let dependency_config = service_config;
      if (dependency_name !== service_config.name) {
        dependency_config = ServiceConfig.loadFromPath(dependency_environment.service_path);
      }

      if (dependency_config.proto) {
        const proto_filename = _removeFileExt(dependency_config.proto);
        const {SnappiClient} = require(path.join(dependency_stubs_path, `${proto_filename}_grpc_pb.js`));
        const rpc_messages = require(path.join(dependency_stubs_path, `${proto_filename}_pb.js`));
        const client = new SnappiClient(
          `${dependency_environment.host}:${dependency_environment.port}`,
          grpc.credentials.createInsecure()
        );

        return {
          client,
          messages: rpc_messages
        };
      }

      return {client: null, messages: null};
    });
  }
}

interface DependencyStubs {
  client: any;
  messages: any;
}

class MainFileError extends Error {
  constructor(module_path: string, service_name: string) {
    super(`Cannot find main file for ${service_name} at ${module_path}`);
  }
}

class DependencyInitializationError extends Error {
  constructor(dependency_name: string, service_name: string) {
    super(`${dependency_name} is required by ${service_name} but has not been started`);
  }
}

class DependencyInstallError extends Error {
  constructor(dependency_name: string, service_name: string) {
    super(`${dependency_name} has not been installed properly for ${service_name}. Try re-running the install command.`);
  }
}
