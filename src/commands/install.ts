import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import * as path from 'path';

import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';

const _info = chalk.blue;
const _error = chalk.red;

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
      this.error(_error(error.message));
    }
  }

  installDependencies(service_path: string) {
    const {flags} = this.parse(Install);
    const service_config = ServiceConfig.loadFromPath(service_path);
    this.log(`Installing dependencies for ${_info(service_config.name)}`);

    // Install all dependencies
    Object.keys(service_config.dependencies).forEach((dependency_name: string) => {
      if (service_config.dependencies.hasOwnProperty(dependency_name)) {
        const dependency_identifier = service_config.dependencies[dependency_name];
        const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(dependency_identifier, service_path);
        ProtocExecutor.execute(dependency_path, service_path, service_config.language);
        if (flags.recursive) {
          this.installDependencies(dependency_path);
        }
      }
    });

    if (service_config.proto) {
      ProtocExecutor.execute(service_path, service_path, service_config.language);
    }
  }
}
