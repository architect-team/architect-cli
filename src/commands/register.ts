import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import MissingContextError from '../common/errors/missing-build-context';
import { AccountUtils } from '../common/utils/account';
import { buildImage, getDigest, pushImage, strip_tag_from_image } from '../common/utils/docker';
import { ServiceNode } from '../dependency-manager/src';
import { ComponentConfigBuilder, RawComponentConfig, RawServiceConfig } from '../dependency-manager/src/component-config/builder';

export interface PutComponentVersionDto {
  tag: string;
  config: RawComponentConfig;
}

export default class ComponentRegister extends Command {
  static aliases = ['component:register', 'components:register', 'c:register', 'comp:register'];
  static description = 'Register a new Component with Architect Cloud';

  static flags = {
    ...Command.flags,
    components: flags.string({
      char: 'c',
      description: 'Path to a component to build',
      exclusive: ['environment'],
      multiple: true,
      hidden: true,
    }),
    environment: flags.string({
      char: 'e',
      description: 'Path to an environment config including local components to build',
      exclusive: ['component'],
      hidden: true,
    }),
    tag: flags.string({
      char: 't',
      description: 'Tag to give to the new component',
      default: 'latest',
    }),
  };

  static args = [{
    name: 'component',
    description: 'Path to a component to register',
  }];

  async run() {
    const { flags, args } = this.parse(ComponentRegister);

    const config_paths: Set<string> = new Set();

    if (args.component) {
      config_paths.add(path.resolve(untildify(args.component)));
    }

    let dependency_manager = await LocalDependencyManager.create(this.app.api);
    if (flags.environment) {
      const config_path = path.resolve(untildify(flags.environment));
      dependency_manager = await LocalDependencyManager.createFromPath(this.app.api, config_path);
      const graph = await dependency_manager.getGraph(false);
      for (const node of graph.nodes) {
        if (node.is_local && node instanceof ServiceNode) {
          config_paths.add(node.local_path);
        }
      }
    } else if (flags.components) {
      for (let config_path of flags.components) {
        config_path = path.resolve(untildify(config_path));
        config_paths.add(config_path);
      }
    }

    if (config_paths.size <= 0) {
      throw new MissingContextError();
    }

    for (const config_path of config_paths) {
      await this.register_component(config_path, flags.tag);
    }
  }

  private async register_component(config_path: string, tag: string) {
    const { raw_config } = await ComponentConfigBuilder.rawFromPath(config_path);

    if (!raw_config.name) {
      throw new Error('Component Config must have a name');
    }

    const account_name = raw_config.name.split('/')[0];
    const selected_account = await AccountUtils.getAccount(this.app.api, account_name).catch(() => undefined);
    if (!selected_account) {
      throw new Error(`You do not have access to the account specified in your component config: ${account_name}`);
    }

    if (!raw_config.services) {
      this.error(`You cannot register the old service spec: ${config_path}.\nPlease upgrade to the new component spec.`,);
    }

    for (const [service_name, service_config] of Object.entries(raw_config.services)) {
      const image_tag = `${this.app.config.registry_host}/${raw_config.name}-${service_name}:${tag}`;
      const image = await this.push_image_if_necessary(config_path, service_name, service_config, image_tag);
      service_config.image = image;
    }

    const component_dto = {
      tag: tag,
      config: raw_config,
    };

    cli.action.start(chalk.blue(`Registering component ${raw_config.name}:${tag} with Architect Cloud...`));
    await this.app.api.post(`/accounts/${selected_account.id}/components`, component_dto);
    cli.action.stop();
    this.log(chalk.green(`Successfully registered component`));
  }

  private async push_image_if_necessary(config_path: string, service_name: string, service_config: RawServiceConfig, image_tag: string) {
    // if the image field is set, we just take their image as is
    if (service_config.image) {
      return service_config.image;
    }

    // otherwise we build and push the image to our repository
    const image = await this.build_image(config_path, service_name, service_config, image_tag);
    await this.push_image(image);
    const digest = await this.get_digest(image);

    // we don't need the tag on our image because we use the digest as the key
    const image_without_tag = strip_tag_from_image(image);
    return `${image_without_tag}@${digest}`;
  }

  private async build_image(config_path: string, service_name: string, service_config: RawServiceConfig, image_tag: string) {
    const build_context = service_config?.build?.context;
    if (!build_context) {
      throw new Error(`Service ${service_name} does not specify an image or a build.context. It must contain one or the other.`);
    }
    try {
      const component_path = fs.lstatSync(config_path).isFile() ? path.dirname(config_path) : config_path;
      const build_path = path.resolve(component_path, build_context);
      let dockerfile;
      if (service_config.build?.dockerfile) {
        dockerfile = path.join(build_path, service_config.build.dockerfile);
      }
      let build_args: string[] = [];
      if (service_config.build?.args) {
        build_args = Object.entries(service_config.build?.args).map(([key, value]) => `${key}=${value}`);
      }
      return await buildImage(build_path, image_tag, dockerfile, build_args);
    } catch (err) {
      cli.action.stop(chalk.red(`Build failed`));
      this.log(`Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present`);
      throw new Error(err);
    }
  }

  private async push_image(image: string) {
    cli.action.start(chalk.blue(`Pushing Docker image for ${image}`));
    try {
      await pushImage(image);
    } catch (err) {
      cli.action.stop(chalk.red(`Push failed for image ${image}`));
      throw new Error(err);
    }
    cli.action.stop();
    this.log(chalk.green(`Successfully pushed Docker image for ${image}`));
  }

  private async get_digest(image: string) {
    cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
    const digest = await getDigest(image).catch(err => {
      cli.action.stop(chalk.red(`Inspect failed`));
      throw new Error(err);
    });
    cli.action.stop();
    this.log(chalk.green(`Image verified`));
    return digest;
  }
}
