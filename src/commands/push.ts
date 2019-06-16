import { flags } from '@oclif/command';
import chalk from 'chalk';
import * as execa from 'execa';
import * as Listr from 'listr';
import * as path from 'path';
import * as url from 'url';

import Command from '../base';
import ServiceConfig from '../common/service-config';
import ServiceDependency from '../common/service-dependency';

import Build from './build';

const _info = chalk.blue;

export default class Push extends Command {
  static description = 'Push service(s) to a registry';

  static flags = {
    help: flags.help({ char: 'h' }),
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

    await Build.run([root_service_path]);

    const root_service = ServiceDependency.create(this.app_config, root_service_path);
    const user = await this.architect.getUser();

    return [{
      title: `Pushing docker image for ${_info(`${user.username}/${root_service.config.full_name}`)}`,
      task: async () => {
        if (root_service.dependencies.some(d => d.local)) {
          throw new Error('Cannot push image with local dependencies');
        } else {
          return this.pushImage(root_service.config);
        }
      }
    }];
  }

  async pushImage(service_config: ServiceConfig) {
    const tag_name = `architect-${service_config.full_name}`;
    const user = await this.architect.getUser();
    const repository_name = url.resolve(`${this.app_config.default_registry_host}/`, `${user.username}/${service_config.full_name}`);
    await execa.shell(`docker tag ${tag_name} ${repository_name}`);
    await execa.shell(`docker push ${repository_name}`);
  }
}
