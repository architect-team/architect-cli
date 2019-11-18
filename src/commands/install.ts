import { flags } from '@oclif/command';
import chalk from 'chalk';
import Listr from 'listr';
import AppConfig from '../app-config/config';
import Command from '../base-command';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';

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
    const { args } = this.parse(Install);
    const renderer = args.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(args.service_id, this.app.config), { renderer });
    await tasks.run();
  }

  async tasks(service_id: string, app_config: AppConfig): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Install);
    const root_service_path = flags.prefix ? flags.prefix : process.cwd();
    const root_service = ServiceDependency.create(app_config, root_service_path);

    if (args.service_name) {
      await root_service.load();
      // eslint-disable-next-line prefer-const
      let [service_name, service_version] = args.service_name.split(':');
      if (!service_version) {
        const { data: service } = await this.app.api.get(`/services/${service_name}`);
        // eslint-disable-next-line require-atomic-updates
        service_version = service.tags.sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }))[0];
      }
      if (root_service.config.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      // Load/install only the new dependency
      const new_dependencies: { [s: string]: string } = {};
      new_dependencies[service_name] = service_version;
      root_service.config.setDependencies(new_dependencies);
      const tasks = await this.get_tasks(root_service, flags.recursive);
      tasks.push({
        title: 'Updating architect.json',
        task: () => {
          const config_json = ServiceConfig.loadJSONFromPath(root_service.service_path);
          config_json.dependencies[service_name] = service_version;
          ServiceConfig.writeToPath(root_service.service_path, config_json);
        },
      });
      return tasks;
    } else {
      return this.get_tasks(root_service, flags.recursive);
    }
  }

  async get_tasks(service_dependency: ServiceDependency, recursive: boolean, _seen: Set<ServiceDependency> = new Set()): Promise<Listr.ListrTask[]> {
    if (_seen.has(service_dependency)) {
      return [];
    } else {
      _seen.add(service_dependency);
    }

    if (service_dependency.local) {
      await service_dependency.load();
    }

    const service_name = service_dependency.local ? service_dependency.config.full_name : service_dependency.service_path;
    const tasks: Listr.ListrTask[] = [{
      title: `Loading ${_info(service_name)}`,
      task: async () => {
        await service_dependency.load();
        let sub_tasks: Listr.ListrTask[] = [];
        if (recursive || service_dependency.root) {
          for (const sub_dependency of service_dependency.dependencies) {
            sub_tasks = sub_tasks.concat(await this.get_tasks(sub_dependency, recursive, _seen));
          }
        }
        return new Listr(sub_tasks);
      },
    }];

    if (service_dependency.local && (recursive || service_dependency.root)) {
      tasks.push({
        title: `Installing dependencies for ${_info(service_name)}`,
        task: async () => {
          const promises = [];
          if (service_dependency.config.api && service_dependency.config.api.type === 'grpc') {
            promises.push(ProtocExecutor.execute(service_dependency, service_dependency, this.error));
          }
          service_dependency.dependencies.forEach(sub_dependency => {
            if (sub_dependency.config.api && sub_dependency.config.api.type === 'grpc') {
              promises.push(ProtocExecutor.execute(sub_dependency, service_dependency, this.error));
            }
          });
          await Promise.all(promises);
        },
      });
    }

    return tasks;
  }
}
