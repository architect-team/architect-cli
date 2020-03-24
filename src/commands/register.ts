import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import MissingContextError from '../common/errors/missing-build-context';
import { buildImage, getDigest, pushImage } from '../common/utils/docker';
import { ServiceConfig } from '../dependency-manager/src';

export interface CreateServiceVersionInput {
  tag: string;
  digest: string;
  config: ServiceConfig;
}

export default class ServiceRegister extends Command {
  static aliases = ['service:register', 'services:register', 'svcs:register', 'svc:register'];
  static description = 'Register a new Service with Architect Cloud';

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
      description: 'Tag to give to the new service',
      default: 'latest',
    }),
    no_build: flags.boolean({
      description: 'Docker image that corresponds to the service',
      default: false,
    }),
  };

  async run() {
    const { flags } = this.parse(ServiceRegister);

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

    this.accounts = await this.get_accounts();

    for (const node of dependency_manager.graph.nodes) {
      if (node instanceof LocalServiceNode) {

        let image;
        if (!flags.no_build) {
          if (node.service_config.getImage()) {
            throw new Error('Your Service config specifies an image. In this case please use the --no_build flag to avoid using the Architect repository.');
          }
          image = await buildImage(node.service_path, this.app.config.registry_host, flags.tag);

          cli.action.start(chalk.blue(`Pushing Docker image for ${image}`));
          try {
            await pushImage(image);
          } catch (err) {
            cli.action.stop(chalk.red(`Push failed for image ${image}`));
          }
          cli.action.stop(chalk.green(`Successfully pushed Docker image for ${image}`));
        } else if (!node.service_config.getImage()) {
          throw new Error('When using the `--no-build` flag, please specify an `image` in your ServiceConfig.');
        } else {
          image = node.service_config.getImage();
        }

        const [account_name, _] = node.service_config.getName().split('/');
        const selected_account = this.accounts.rows.find((a: any) => a.name === account_name);

        cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
        const digest = await getDigest(image).catch(e => {
          cli.action.stop(chalk.red(`Inspect failed`));
          throw new Error(`The image specified in your ServiceConfig is not reachable by docker: ${node.service_config.getImage()}`);
        });
        cli.action.stop(chalk.green(`Image verified`));

        const service_dto = {
          tag: flags.tag,
          digest: digest,
          config: node.service_config,
        };
        cli.action.start(chalk.blue(`Registering service ${node.service_config.getName()}:${flags.tag} with Architect Cloud...`));
        await this.post_service_to_api(service_dto, selected_account.id);
        cli.action.stop(chalk.green(`Successfully registered service`));
      }
    }
  }

  private async post_service_to_api(dto: CreateServiceVersionInput, account_id: string): Promise<any> {
    try {
      const { data: service_digest } = await this.app.api.post(`/accounts/${account_id}/services`, dto);
      return service_digest;
    } catch (err) {
      //TODO:89:we shouldn't have to do this on the client side
      if (err.response?.data?.statusCode === 403) {
        throw new Error(`You do not have permission to create a ServiceVersion for the selected account.`);
      }
      if (err.response?.data?.status === 409) {
        throw new Error(`The server responded with 409 CONFLICT. Perhaps this Service name already exists under that account?`);
      }
      if (err.response?.data?.message?.message) {
        throw new Error(JSON.stringify(err.response?.data?.message?.message));
      }
      if (err.response?.data?.message) {
        throw new Error(err.response?.data?.message);
      }
      throw new Error(err);
    }
  }
}
