import { flags } from '@oclif/command';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as Listr from 'listr';
import * as path from 'path';
import * as url from 'url';

import Command from '../base';
import ServiceConfig from '../common/service-config';

import Build from './build';

const _info = chalk.blue;
const _error = chalk.red;
const _success = chalk.green;

export default class Push extends Command {
  static description = 'Push service(s) to a registry';

  static flags = {
    help: flags.help({ char: 'h' }),
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

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build'
    }
  ];

  async run() {
    const { args, flags } = this.parse(Push);
    if (flags.recursive && flags.tag) {
      this.error(_error('Cannot specify tag for recursive pushes'));
    }

    let root_service_path = process.cwd();
    if (args.context) {
      root_service_path = path.resolve(args.context);
    }

    const tasks = new Listr(await this.getTasks(root_service_path, flags.recursive, flags.tag), { concurrent: 2 });
    await tasks.run();
    this.log(_success('Pushed'));
  }

  async getTasks(service_path: string, recursive: boolean, tag?: string): Promise<Listr.ListrTask[]> {
    const dependencies = await ServiceConfig.getDependencies(service_path, recursive);
    const tasks: Listr.ListrTask[] = [];
    dependencies.forEach(dependency => {
      tasks.push({
        title: _info(`Pushing docker image for ${dependency.service_config.name}`),
        task: async () => {
          await this.pushImage(dependency.service_path, dependency.service_config, tag);
        }
      });
    });
    return tasks;
  }

  async pushImage(service_path: string, service_config: ServiceConfig, tag?: string) {
    await Build.run([service_path]);
    const tag_name = tag || `architect-${service_config.name}`;
    const repository_name = url.resolve('localhost:8081/', tag_name);
    execSync(`docker push ${repository_name}`);
  }
}
