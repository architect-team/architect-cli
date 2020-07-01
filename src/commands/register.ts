import { flags } from '@oclif/command';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import MissingContextError from '../common/errors/missing-build-context';
import { buildImage, getDigest, pushImage, strip_tag_from_image } from '../common/utils/docker';
import { ServiceConfig, ServiceNode } from '../dependency-manager/src';
import { ComponentConfigBuilder } from '../dependency-manager/src/component-config/builder';

export interface PutComponentVersionDto {
  tag: string;
  config: any;
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
    }),
    environment: flags.string({
      char: 'e',
      description: 'Path to an environment config including local components to build',
      exclusive: ['component', 'image'],
    }),
    tag: flags.string({
      char: 't',
      description: 'Tag to give to the new component',
      default: 'latest',
    }),
  };

  async run() {
    const { flags } = this.parse(ComponentRegister);

    const config_paths: Set<string> = new Set();

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
    } else {
      throw new MissingContextError();
    }

    this.accounts = await this.get_accounts();

    for (const config_path of config_paths) {
      await this.register_component(config_path, flags.tag);
    }
  }

  private async register_component(config_path: string, tag: string) {
    const component_config = await ComponentConfigBuilder.buildFromPath(config_path);

    const [account_name, _] = component_config.getRef().split('/');
    const selected_account = this.accounts.rows.find((a: any) => a.name === account_name);
    if (!selected_account) {
      throw new Error(`You do not have access to the account specified in your component config: ${account_name}`);
    }

    for (const [service_ref, service_config] of Object.entries(component_config.getServices())) {
      const image_tag = `${this.app.config.registry_host}/${component_config.getName()}-${service_config.getName()}:${tag}`;
      const image = await this.build_docker_image_if_necessary(config_path, service_config, image_tag);
      component_config.getServiceByRef(service_ref)?.setImage(image);
    }

    const component_dto = {
      tag: tag,
      config: classToPlain(component_config),
    };

    cli.action.start(chalk.blue(`Registering component ${component_config.getName()}:${tag} with Architect Cloud...`));
    await this.post_component_to_api(component_dto, selected_account.id);
    cli.action.stop(chalk.green(`Successfully registered component`));
  }


  private async build_docker_image_if_necessary(config_path: string, service_config: ServiceConfig, image_tag: string) {
    // if the image field is set, we just take their image as is
    if (service_config.getImage()) {
      return service_config.getImage();
    }

    // otherwise we build and push the image to our repository
    const image = await this.build_image(config_path, service_config, image_tag);
    await this.push_image(image);
    const digest = await this.get_digest(image);

    // we don't need the tag on our image because we use the digest as the key
    const image_without_tag = strip_tag_from_image(image);
    return `${image_without_tag}@${digest}`;
  }


  private async build_image(config_path: string, service_config: ServiceConfig, image_tag: string) {
    const build_context = service_config.getBuild().context;
    if (!build_context) {
      throw new Error(`Service ${service_config.getName()} does not specify an image or a build.context. It must contain one or the other.`);
    }
    try {
      const component_path = fs.lstatSync(config_path).isFile() ? path.dirname(config_path) : config_path;
      const build_path = path.resolve(component_path, build_context);

      return await buildImage(build_path, image_tag);
    } catch (err) {
      cli.action.stop(chalk.red(`Build failed`));
      this.log(`Docker build failed. If an image is not specified in your service config or as a flag, then a Dockerfile must be present`);
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
    cli.action.stop(chalk.green(`Successfully pushed Docker image for ${image}`));
  }


  private async get_digest(image: string) {
    cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
    const digest = await getDigest(image).catch(e => {
      cli.action.stop(chalk.red(`Inspect failed`));
      throw new Error(`The image is not reachable by docker: ${image}`);
    });
    cli.action.stop(chalk.green(`Image verified`));
  }


  private async post_component_to_api(dto: PutComponentVersionDto, account_id: string): Promise<any> {
    const { data: component_version } = await this.app.api.post(`/accounts/${account_id}/components`, dto);
    return component_version;
  }
}
