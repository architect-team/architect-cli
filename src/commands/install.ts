import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as Listr from 'listr';
import * as path from 'path';

import Command from '../base';
import ProtocExecutor from '../common/protoc-executor';
import ServiceConfig from '../common/service-config';

const _info = chalk.blue;
const _error = chalk.red;
const _success = chalk.green;

export default class Install extends Command {
  static description = 'Install dependencies of the current service';

  static flags = {
    help: flags.help({ char: 'h' }),
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
    const { flags } = this.parse(Install);
    let process_path = process.cwd();
    if (flags.prefix) {
      process_path = path.isAbsolute(flags.prefix) ?
        flags.prefix :
        path.join(process_path, flags.prefix);
    }

    const tasks = new Listr(await this.getTasks(process_path, flags.recursive), { concurrent: 3 });
    await tasks.run();
    this.log(_success('Installed'));
  }

  async getTasks(root_service_path: string, recursive: boolean): Promise<Listr.ListrTask[]> {
    const tasks: Listr.ListrTask[] = [];
    const dependencies = await ServiceConfig.getDependencies(root_service_path, recursive);
    dependencies.forEach(dependency => {
      const sub_tasks: Listr.ListrTask[] = [];

      if (dependency.service_config.proto) {
        sub_tasks.push({
          title: _info(dependency.service_config.name),
          task: () => {
            return ProtocExecutor.execute(dependency.service_path, dependency.service_path, dependency.service_config.language);
          }
        });
      }

      dependency.dependencies.forEach(sub_dependency => {
        sub_tasks.push({
          title: _info(sub_dependency.service_config.name),
          task: () => {
            return ProtocExecutor.execute(sub_dependency.service_path, dependency.service_path, dependency.service_config.language);
          }
        });
      });

      tasks.push({
        title: `Installing dependencies for ${_info(dependency.service_config.name)}`,
        task: () => {
          return new Listr(sub_tasks, { concurrent: 2 });
        }
      });
    });

    return tasks;
  }
}
