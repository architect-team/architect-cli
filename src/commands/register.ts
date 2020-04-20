import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import inquirer from 'inquirer';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { LocalServiceNode } from '../common/dependency-manager/local-service-node';
import MissingContextError from '../common/errors/missing-build-context';
import { buildImage, getDigest, pushImage, strip_tag_from_image } from '../common/utils/docker';
import { OfflineUtils } from '../common/utils/offline';
import { ValidationClient, ValidationResult } from '../common/utils/validation';
import { ServiceConfig } from '../dependency-manager/src';

export interface CreateServiceVersionInput {
  tag: string;
  digest: string;
  config: any;
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
      exclusive: ['service', 'image'],
    }),
    tag: flags.string({
      char: 't',
      description: 'Tag to give to the new service',
      default: 'latest',
    }),
    image: flags.string({
      char: 'i',
      description: 'The docker image of the service.',
      exclusive: ['environment'],
      required: false,
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

        // await this.validate_service_config(node.service_config);

        let image;
        // if both image flag and image in service_config are set, warn and prompt user
        if (flags.image && node.service_config.getImage()) {
          const override_image_prompt: any = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'override',
              message: 'Warning: an image already exists in this service config, are you sure you want to override it?',
            },
          ]);

          if (override_image_prompt.override === false) {
            throw new Error('Okay, exiting...');
          }
          image = flags.image;
        } else if (flags.image) {
          image = flags.image;
        } else if (node.service_config.getImage()) {
          image = node.service_config.getImage();
        } else {
          cli.action.start(chalk.blue(`Building Docker image...`));
          try {
            image = await buildImage(node, this.app.config.registry_host, flags.tag);
          } catch (err) {
            cli.action.stop(chalk.red(`Build failed`));
            throw new Error(`Docker build failed. If an image is not specified in your service config or as a flag, then a Dockerfile must be present at ${node.service_path}`);
          }

          cli.action.start(chalk.blue(`Pushing Docker image for ${image}`));
          try {
            await pushImage(image);
          } catch (err) {
            cli.action.stop(chalk.red(`Push failed for image ${image}`));
            throw new Error(err);
          }
          cli.action.stop(chalk.green(`Successfully pushed Docker image for ${image}`));
        }

        const [account_name, _] = node.service_config.getName().split('/');
        const selected_account = this.accounts.rows.find((a: any) => a.name === account_name);
        if (!selected_account) {
          throw new Error(`You do not have access to the account specified in your service config: ${account_name}`);
        }

        cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
        const digest = await getDigest(image).catch(e => {
          cli.action.stop(chalk.red(`Inspect failed`));
          throw new Error(`The image specified in your ServiceConfig is not reachable by docker: ${node.service_config.getImage()}`);
        });
        cli.action.stop(chalk.green(`Image verified`));

        const image_without_tag = strip_tag_from_image(image); // we don't need the tag on our image because we use the digest as the key.

        const service_dto = {
          tag: flags.tag,
          digest: digest,
          config: {
            ...node.service_config,
            image: image_without_tag,
          },
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

  async validate_service_config(config: ServiceConfig): Promise<void> {
    cli.action.start(chalk.blue('Validating service config'));

    let validation_results;
    try {
      const response = await this.app.api.post<ValidationResult[]>(`/services/validation`, config, { timeout: 2000 });
      validation_results = response.data;
    } catch (err) {
      // we don't want to block local deployments from working without an internet connection so we play nice if the call fails
      if (OfflineUtils.indicates_offline(err)) {
        cli.action.stop(chalk.yellow(`Warning: Could not connect to the Architect API to validate the service config, carrying on anyway...`));
        return;
      } else {
        cli.action.stop(chalk.red(`Error, did not run validation`));
        throw new Error(err.response.data.message);
      }
    }

    const summary = ValidationClient.summarize(validation_results);
    if (summary.all_passing) {
      cli.action.stop(chalk.green(`${summary.passing_count} rules passing`));
    } else {
      cli.action.stop(summary.message);
    }

    if (!summary.all_passing) {
      this.log('\n');
      this.log(summary.failure_report);
      this.log(chalk.blue(`...${summary.passing_count} other rules passing\n`));
    }

    if (summary.blocker_count > 0) {
      this.error('The service failed validation.');
    }
  }
}
