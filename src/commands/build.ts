import {Command, flags} from '@oclif/command';
import chalk from 'chalk';
import {execSync} from 'child_process';
import * as path from 'path';

import MANAGED_PATHS from '../common/managed-paths';
import ServiceConfig from '../common/service-config';

import Install from './install';

const _info = chalk.blue;

export default class Build extends Command {
  static description = `Create an ${MANAGED_PATHS.ARCHITECT_JSON} file for a service`;

  static flags = {
    help: flags.help({char: 'h'}),
    tag: flags.string({
      char: 't',
      required: false,
      description: 'Name and optionally a tag in the ‘name:tag’ format'
    }),
    recursive: flags.boolean({
      char: 'r',
      default: false,
      description: 'Whether or not to build images for the cited dependencies'
    })
  };

  static args = [];

  async run() {
    const root_service_path = process.cwd();
    await this.buildImage(root_service_path);
    this.exit();
  }

  async buildImage(service_path: string) {
    const {flags} = this.parse(Build);
    const service_config = ServiceConfig.loadFromPath(service_path);

    if (flags.recursive) {
      const dependency_names = Object.keys(service_config.dependencies);
      for (let dependency_name of dependency_names) {
        const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(
          service_config.dependencies[dependency_name]
        );
        await this.buildImage(dependency_path);
      }
    }

    this.log(_info(`Building docker image for ${service_config.name}`));
    const dockerfile_path = path.join(__dirname, '../../Dockerfile');
    await Install.run(['--prefix', service_path]);
    execSync(`docker build --build-arg SERVICE_LANGUAGE=${service_config.language} -t architect-${service_config.name} -f ${dockerfile_path} ${service_path}`, {stdio: 'inherit'});
  }
}
