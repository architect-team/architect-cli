import { flags } from '@oclif/command';
import chalk from 'chalk';
import Listr from 'listr';
import path from 'path';
import Command from '../base';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';


const _info = chalk.blue;

export default class Install extends Command {
  static description = 'Install dependencies of the current service';

  static flags = {
    help: flags.help({ char: 'h' }),
    prefix: flags.string({
      char: 'p',
      description: 'Path prefix indicating where the install command should execute from'
    }),
    recursive: flags.boolean({
      char: 'r',
      description: 'Generate architect dependency files for all services in the dependency tree'
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose log output'
    })
  };

  static args = [
    {
      name: 'service_name',
      description: 'Remote service dependency',
      required: false
    }
  ];

  async run() {
    const { flags } = this.parse(Install);
    const renderer = flags.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(), { renderer });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Install);
    let root_service_path = flags.prefix ? flags.prefix : process.cwd();

    const root_service = ServiceDependency.create(this.app_config, root_service_path);
    if (args.service_name) {
      await root_service.load();
      const [service_name, service_version] = args.service_name.split(':');
      if (!service_version) {
        throw new Error('Specify version ex. service:0.1.0');
      }
      if (root_service.config.name === service_name) {
        throw new Error('Cannot install a service inside its own config');
      }

      // Load/install only the new dependency
      const new_dependencies: { [s: string]: string } = {};
      new_dependencies[service_name] = service_version;
      root_service.config.setDependencies(new_dependencies);

      const tasks = this.get_tasks(root_service, flags.recursive);
      tasks.push({
        title: 'Updating architect.json',
        task: () => {
          const config_json = ServiceConfig.loadJSONFromPath(root_service_path);
          config_json.dependencies[service_name] = service_version;
          ServiceConfig.writeToPath(root_service_path, config_json);
        }
      });
      return tasks;
    } else {
      return this.get_tasks(root_service, flags.recursive);
    }
  }

  get_tasks(service_dependency: ServiceDependency, recursive: boolean, _seen: Set<ServiceDependency> = new Set()): Listr.ListrTask[] {
    if (_seen.has(service_dependency)) {
      return [];
    } else {
      _seen.add(service_dependency);
    }
    let service_name = service_dependency.local ? path.basename(service_dependency.service_path) : service_dependency.service_path;
    let tasks: Listr.ListrTask[] = [{
      title: `Loading ${_info(service_name)}`,
      task: async () => {
        await service_dependency.load();
        let sub_tasks: Listr.ListrTask[] = [];
        if (recursive || service_dependency.root) {
          service_dependency.dependencies.forEach(sub_dependency => {
            sub_tasks = sub_tasks.concat(this.get_tasks(sub_dependency, recursive, _seen));
          });
        }
        return new Listr(sub_tasks);
      }
    }];

    if (service_dependency.local && (recursive || service_dependency.root)) {
      tasks.push({
        title: `Installing dependencies for ${_info(service_name)}`,
        task: async () => {
          const start = new Date();
          const promises = [];
          if (service_dependency.config.interface && service_dependency.config.interface.type === 'grpc') {
            promises.push(ProtocExecutor.execute(service_dependency, service_dependency));
          }
          service_dependency.dependencies.forEach(sub_dependency => {
            if (sub_dependency.config.interface && sub_dependency.config.interface.type === 'grpc') {
              promises.push(ProtocExecutor.execute(sub_dependency, service_dependency));
            }
          });
          await Promise.all(promises);
          await ProtocExecutor.clear(service_dependency, start);
        }
      });
    }

    return tasks;
  }
}
