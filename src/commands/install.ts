import {Command, flags} from '@oclif/command';
import {existsSync, mkdirSync} from 'fs';
import * as path from 'path';

import MANAGED_PATHS from '../common/managed-paths';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';

export default class Install extends Command {
  static description = 'Install dependencies of the current service';

  static flags = {
    help: flags.help({char: 'h'}),
    prefix: flags.string({
      char: 'p',
      description: 'Path prefix indicating where the install command should execute from.'
    }),
    recursive: flags.boolean({
      char: 'r',
      description: 'Generate architect dependency files for all services in the dependency tree.'
    })
  };

  static args = [];

  async run() {
    try {
      const {flags} = this.parse(Install);
      let process_path = process.cwd();
      if (flags.prefix) {
        process_path = path.isAbsolute(flags.prefix) ?
          flags.prefix :
          path.join(process_path, flags.prefix);
      }
      this.installDependencies(process_path);
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
        const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(dependency_identifier, service_path);
        ProtocExecutor.execute(dependency_path, stubs_directory, service_config.language);
        if (flags.recursive) {
          this.installDependencies(dependency_path);
        }
      }
    });

    if (service_config.proto) {
      ProtocExecutor.execute(service_path, stubs_directory, service_config.language);
    }
  }
}
