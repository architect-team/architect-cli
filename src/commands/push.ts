import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as execa from 'execa';
import * as Listr from 'listr';
import * as path from 'path';
import * as url from 'url';

import Command from '../base';
import ServiceConfig from '../common/service-config';

import Build from './build';

const _info = chalk.blue;
const _error = chalk.red;

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
    }),
    verbose: flags.boolean({
      char: 'v',
      description: 'Verbose log output'
    })
  };

  static args = [
    {
      name: 'context',
      description: 'Path to the service to build'
    }
  ];

  async run() {
    const { flags } = this.parse(Push);
    if (flags.recursive && flags.tag) {
      this.error(_error('Cannot specify tag for recursive pushes'));
    }
    const renderer = flags.verbose ? 'verbose' : 'default';
    const tasks = new Listr(await this.tasks(), { concurrent: 2, renderer });
    await tasks.run();
  }

  async tasks(): Promise<Listr.ListrTask[]> {
    const { args, flags } = this.parse(Push);
    let root_service_path = process.cwd();
    if (args.context) {
      root_service_path = path.resolve(args.context);
    }

    const dependencies = await ServiceConfig.getDependencies(root_service_path, flags.recursive);
    const tasks: Listr.ListrTask[] = [];
    dependencies.forEach(dependency => {
      tasks.push({
        title: `Pushing docker image for ${_info(dependency.service_config.name)}`,
        task: async () => {
          const build_tasks = await Build.tasks([dependency.service_path, '-t', flags.tag || '']);
          const push_task = {
            title: 'Pushing',
            task: async () => {
              await this.pushImage(dependency.service_config, flags.tag);
            }
          };
          return new Listr(build_tasks.concat([push_task]));
        }
      });
    });
    return tasks;
  }

  async pushImage(service_config: ServiceConfig, tag?: string) {
    const tag_name = tag || `architect-${service_config.name}`;
    const user = await this.architect.user;
    const repository_name = url.resolve(`${this.app_config.default_registry_host}/`, `${user.username}/${service_config.name}`);
    await execa.shell(`docker tag ${tag_name} ${repository_name}`);
    await execa.shell(`docker push ${repository_name}`);
  }
}
