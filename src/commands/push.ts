import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import MissingContextError from '../common/errors/missing-build-context';
import { buildImage, pushImage } from '../common/utils/docker';


export default class Push extends Command {
  static description = 'Push service(s) to a registry';

  static flags = {
    ...Command.flags,
    services: flags.string({
      char: 's',
      description: 'Path to a service to build',
      exclusive: ['environment'],
      multiple: true,
    }),
    environment: flags.string({
      char: 'e',
      description: 'Path to an environment config including local services to build',
      exclusive: ['service'],
    }),
    tag: flags.string({
      char: 't',
      description: 'Tag to give to the new Docker image(s)',
      default: 'latest',
    }),
  };

  async run() {
    const { flags } = this.parse(Push);

    let dependency_manager = new LocalDependencyManager(this.app.api);
    if (flags.environment) {
      const config_path = path.resolve(untildify(flags.environment));
      dependency_manager = await LocalDependencyManager.createFromPath(this.app.api, config_path);
    } else if (flags.services) {
      for (let service_path of flags.services) {
        service_path = path.resolve(untildify(service_path));
        await dependency_manager.loadLocalService(service_path);
      }
    } else {
      throw new MissingContextError();
    }

    dependency_manager.graph.nodes.forEach(async (node) => {
      if (node instanceof LocalServiceNode) {
        const tag = await buildImage(node.service_path, this.app.config.registry_host, flags.tag);
        cli.action.start(chalk.blue(`Pushing Docker image for ${tag}`));
        await pushImage(tag);
        cli.action.stop(chalk.green(`Successfully pushed Docker image for ${node.name}`));
      }
    });
  }
}
