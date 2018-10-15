import {Command, flags} from '@oclif/command';
import * as fs from 'fs';
import * as grpc from 'grpc';
import * as os from 'os';
import * as path from 'path';
import * as proxyquire from 'proxyquire';

import DeploymentConfig from './deployment-config';
import MANAGED_PATHS from './managed-paths';
import ServiceConfig from './service-config';

const _removeFileExt = (filename: string): string =>
  filename.slice(0, filename.lastIndexOf('.'));

const _expandPath = (file: string): string =>
  file.indexOf('~') === 0 ?
    path.join(os.homedir(), file.substr(1)) :
    path.resolve(file);

class ArchitectJavascriptLauncher extends Command {
  static description = 'Launches instances of architect services written in javascript';

  static flags = {
    // add --version flag to show CLI version
    version: flags.version({char: 'v'}),
    help: flags.help({char: 'h'}),
    service_path: flags.string({
      char: 's',
      description: 'Local path of the service to launch',
      required: true,
      parse: _expandPath
    }),
    config_path: flags.string({
      char: 'c',
      description: 'Local path of the configuration file containing dependency details',
      required: true,
      parse: _expandPath
    }),
    target_port: flags.integer({
      char: 'p',
      description: 'Port to run the service on',
      required: true,
    })
  };

  async run() {
    proxyquire.noCallThru();
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

    deployment_config[service_config.name] = {
      host: '0.0.0.0',
      port: target_port,
      service_path,
    };

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
      const grpc_service_details = proxyquire(path.join(service_stubs_path, `${proto_filename}_grpc_pb.js`), {grpc});
      const service_init = grpc_service_details.SnappiService;

      let server = new grpc.Server();
      server.addService(service_init, new module(...module_args));
      server.bind(`0.0.0.0:${target_port}`, grpc.ServerCredentials.createInsecure());
      server.start();
      this.log('Host: 0.0.0.0');
      this.log(`Port: ${target_port}`);
    } else {
      delete deployment_config[service_config.name];
      new module(...module_args);
    }
    proxyquire.callThru();
  }

  generateServiceArgs(
    service_config: ServiceConfig,
    deployment_config: DeploymentConfig,
    stubs_path: string,
    dependencies: string[]
  ): DependencyStubs[] {
    return dependencies.map((dependency_name: string) => {
      if (
        dependency_name !== service_config.name &&
        !deployment_config.hasOwnProperty(dependency_name)
      ) {
        throw new DependencyInitializationError(dependency_name, service_config.name);
      }

      const dependency_stubs_path = path.join(stubs_path, dependency_name);
      if (!fs.existsSync(dependency_stubs_path)) {
        throw new DependencyInstallError(dependency_name, service_config.name);
      }

      let dependency_environment = deployment_config[dependency_name];

      let dependency_config = service_config;
      if (dependency_name !== service_config.name) {
        dependency_config = ServiceConfig.loadFromPath(dependency_environment.service_path);
      }

      if (dependency_config.proto) {
        const proto_filename = _removeFileExt(dependency_config.proto);
        const {SnappiClient} = proxyquire(path.join(dependency_stubs_path, `${proto_filename}_grpc_pb.js`), {grpc});
        const rpc_messages = proxyquire(path.join(dependency_stubs_path, `${proto_filename}_pb.js`), {grpc});
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

export = ArchitectJavascriptLauncher;
