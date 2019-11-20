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
      // load and install ONLY the new dependency
      // eslint-disable-next-line prefer-const
      let [service_name, service_version] = args.service_name.split(':');
      if (!service_version) {
        // TODO: fail?
      }
      const { data: service } = await this.app.api.get(`/services/${service_name}`);
      // eslint-disable-next-line require-atomic-updates
      service_version = service.tags.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))[0];

      if (root_service.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      // Load/install only the new dependency
      const new_dependencies: { [s: string]: string } = {};
      new_dependencies[service_name] = service_version; // TODO: check if it's already installed, and warn?
      const config = ServiceConfig.loadFromPath(root_service_path);
      const all_dependencies = Object.assign({}, config.dependencies, new_dependencies)
      config.setDependencies(all_dependencies);
      await this.installRemoteDefinitions(root_service, `${service_name}:${service_version}`); // TODO: -r for single remote services?
      ServiceConfig.saveToPath(root_service_path, config);
    } else {
      await this.installTasks(root_service, flags.recursive);
    }
  }

  // tag specified, non recursive
  async installRemoteDefinitions(service_dependency: LocalDependencyNode, remote_service_version: string) {
    const remote_service_definitions = await this.get_config(remote_service_version);
    ProtocExecutor.execute_remote(remote_service_definitions, remote_service_version.split(':')[0], service_dependency);
  }

  async get_config(remote_service_version: string) {
    const repository_name = url.resolve(`${this.app.config.registry_host}/`, `${remote_service_version}`);

    let config;
    try {
      config = await this._load_config(repository_name);
    } catch {
      await execa('docker', ['pull', repository_name]);
      config = await this._load_config(repository_name);
    }
    return config;
  }

  async _load_config(repository_name: string) {
    const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "architect.json"}}']);
    const config = JSON.parse(stdout);
    if (config.api) {
      const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "api_definitions"}}']);
      return JSON.parse(stdout);
    }
  }

  async installTasks(service_dependency: LocalDependencyNode, recursive: boolean) {
    const dependencies = await genFromLocalPaths([process.cwd()], undefined, true);

    if (recursive) {
      const service_dependencies = [service_dependency];
      while (service_dependencies.length) { // check to see if pair has been generated already to avoid circular dependencies

        const target_dependency = service_dependencies.pop();
        if (!target_dependency) { return; }
        await ProtocExecutor.execute((target_dependency as LocalDependencyNode), target_dependency);
        console.log(`${target_dependency.name} | ${target_dependency.name}`)
        const directDependencies = dependencies.getNodeDependencies(target_dependency);
        for (const dependency of directDependencies) {
          // generate for target service and dependencies, then push dependencies
          if (!dependency.isDatastore) {
            await ProtocExecutor.execute((dependency as LocalDependencyNode), target_dependency);
            console.log(`${target_dependency.name} | ${dependency.name}`)
            service_dependencies.push(dependency as LocalDependencyNode);
          }
        }
      }

    } else { // without -r

      // non-recursive, without specific tag on command line
      await ProtocExecutor.execute((service_dependency as LocalDependencyNode), service_dependency);
      const directDependencies = dependencies.getNodeDependencies(service_dependency);
      for (const direct_dependency of directDependencies) {
        await ProtocExecutor.execute((direct_dependency as LocalDependencyNode), service_dependency);
      }
    }
  }
}
