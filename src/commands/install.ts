import { flags } from '@oclif/command';
import chalk from 'chalk';
import Command from '../base-command';
import { LocalDependencyNode } from '../common/dependency-manager/node/local';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';
import { genFromLocalPaths } from '../common/utils/dependency';

declare const process: NodeJS.Process;
const _info = chalk.blue;

export default class Install extends Command {
  static description = 'Install services and generate the corresponding client libraries';

  static args = [{
    name: 'service_name',
    description: 'Name of or path to the service to install',
    required: false,
  }];

  static flags = {
    ...Command.flags,
    prefix: flags.string({
      char: 'p',
      description: 'Path prefix indicating where the install command should execute from',
    }),
    service: flags.string({
      char: 's',
      description: 'Path to services to generate client code for',
      multiple: true,
      exclusive: ['service_name'],
    }),
    recursive: flags.boolean({
      char: 'r',
      description: 'Recursively generates required client code for downstream dependencies',
      default: false,
      exclusive: ['service_name'],
    }),
  };

  async run() {
    await this.tasks();
  }

  async tasks() {
    const { args, flags } = this.parse(Install);
    const root_service_path = flags.prefix ? flags.prefix : process.cwd();
    const root_service = (await genFromLocalPaths([process.cwd()])).nodes.values().next().value; // TODO: error checking

    if (args.service_name) {
      // load and install ONLY the new dependency
      // eslint-disable-next-line prefer-const
      let [service_name, service_version] = args.service_name.split(':');
      if (!service_version) { // TODO: do we need this?
        const { data: service } = await this.app.api.get(`/services/${service_name}`);
        // eslint-disable-next-line require-atomic-updates
        service_version = service.tags.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))[0];
      }
      if (root_service.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      // Load/install only the new dependency
      const new_dependencies: { [s: string]: string } = {};
      new_dependencies[service_name] = service_version;
      const config = ServiceConfig.loadFromPath(root_service_path);
      config.setDependencies(new_dependencies);
      await this.installTasks(root_service, flags.recursive);
      ServiceConfig.saveToPath(root_service_path, config);
    } else {
      await this.installTasks(root_service, flags.recursive);
    }
  }

  async installTasks(service_dependency: LocalDependencyNode, recursive: boolean) {
    const dependencies = await genFromLocalPaths([process.cwd()], undefined, recursive);

    dependencies.nodes.forEach(async dependency => {
      console.log(dependency.name)
      if (dependency.api_type && dependency.api_type === 'grpc') {
        await ProtocExecutor.execute((dependency as LocalDependencyNode), service_dependency);
      }
    });
  }
}
