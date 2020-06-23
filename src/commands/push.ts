import { flags } from '@oclif/command';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
import { cli } from 'cli-ux';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import MissingContextError from '../common/errors/missing-build-context';
import { buildImage, getDigest, pushImage } from '../common/utils/docker';
import { ServiceNode } from '../dependency-manager/src';
import { CreateServiceVersionInput } from './register';


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

    let dependency_manager = await LocalDependencyManager.create(this.app.api);
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

    this.accounts = await this.get_accounts();

    const graph = await dependency_manager.getGraph();
    for (const node of graph.nodes) {
      if (node.is_local && node instanceof ServiceNode) {
        const tag = await buildImage(node, this.app.config.registry_host, flags.tag);
        cli.action.start(chalk.blue(`Pushing Docker image for ${tag}`));
        try {
          await pushImage(tag);
        } catch (err) {
          cli.action.stop(chalk.red(`Push failed for image ${tag}`));
        }
        cli.action.stop(chalk.green(`Successfully pushed Docker image for ${tag}`));

        const [account_name, _] = node.service_config.getName().split('/');
        const selected_account = this.accounts.rows.find((a: any) => a.name === account_name);

        cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${tag}`));
        const digest = await getDigest(tag).catch(e => {
          cli.action.stop(chalk.red(`Inspect failed`));
          throw new Error(`The image specified in your ServiceConfig is not reachable by docker: ${node.service_config.getImage()}`);
        });
        cli.action.stop(chalk.green(`Image verified`));

        const service_dto = {
          tag: flags.tag,
          digest: digest,
          config: classToPlain(node.service_config),
        };
        cli.action.start(chalk.blue(`Registering service ${node.service_config.getName()}:${flags.tag} with Architect Cloud...`));
        await this.post_service_to_api(service_dto, selected_account.id);
        cli.action.stop(chalk.green(`Successfully registered service`));
      }
    }
  }

  private async post_service_to_api(dto: CreateServiceVersionInput, account_id: string): Promise<any> {
    const { data: service_digest } = await this.app.api.post(`/accounts/${account_id}/services`, dto);
    return service_digest;
  }
}
