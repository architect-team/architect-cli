import { flags } from '@oclif/command';
import chalk from 'chalk';
import execa from 'execa';
import url from 'url';
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
      // eslint-disable-next-line prefer-const
      let [service_name, service_version] = args.service_name.split(':');
      if (!service_version) { // TODO: also check if the api is defined as grpc here
        // TODO: fail?
      }
      const { data: service } = await this.app.api.get(`/services/${service_name}/versions/${service_version}`);

      if (root_service.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      const new_dependencies: { [s: string]: string } = {};
      new_dependencies[service_name] = service_version; // TODO: check if it's already installed, and warn?
      const config = ServiceConfig.loadFromPath(root_service_path);
      const all_dependencies = Object.assign({}, config.dependencies, new_dependencies);
      config.setDependencies(all_dependencies);
      const api_definitions_contents = await this.get_remote_definitions(args.service_name);

      ProtocExecutor.execute(root_service, undefined, { api_definitions_contents, service_name });

      ServiceConfig.saveToPath(root_service_path, config);
    } else {
      await this.installServices(root_service, flags.recursive);
    }
  }

  async get_remote_definitions(remote_service_version: string) {
    const repository_name = url.resolve(`${this.app.config.registry_host}/`, `${remote_service_version}`);

    let config;
    try {
      config = await this.load_service_config(repository_name);
    } catch {
      await execa('docker', ['pull', repository_name]);
      config = await this.load_service_config(repository_name);
    }
    return config;
  }

  async load_service_config(repository_name: string) {
    const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "architect.json"}}']);
    const config = JSON.parse(stdout);
    if (config.api) {
      const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "api_definitions"}}']);
      return JSON.parse(stdout);
    }
  }

  async installServices(service_dependency: LocalDependencyNode, recursive: boolean) { // TODO: logging and success/error
    const dependencies = await genFromLocalPaths([process.cwd()], undefined, true);

    const service_dependencies = [service_dependency];
    const _seen = [];
    while (service_dependencies.length) {
      const target_dependency = service_dependencies.pop();
      _seen.push(target_dependency!.name);

      await ProtocExecutor.execute(target_dependency!, (target_dependency as LocalDependencyNode));

      const directDependencies = dependencies.getNodeDependencies(target_dependency!);
      for (const dependency of directDependencies) {
        if (!dependency.isDatastore) {
          await ProtocExecutor.execute(target_dependency!, (dependency as LocalDependencyNode));
          if (recursive && !_seen.includes(dependency.name)) {
            service_dependencies.push(dependency as LocalDependencyNode);
          }
        }
      }
    }
  }
}
