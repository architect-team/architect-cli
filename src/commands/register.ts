import { flags } from '@oclif/command';
import chalk from 'chalk';
import { cli } from 'cli-ux';
import fs from 'fs-extra';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import Command from '../base-command';
import MissingContextError from '../common/errors/missing-build-context';
import { AccountUtils } from '../common/utils/account';
import * as Docker from '../common/utils/docker';
import { oras } from '../common/utils/oras';
import { Refs } from '../dependency-manager/src';
import { ComponentConfigBuilder, RawComponentConfig, RawServiceConfig } from '../dependency-manager/src/spec/component/component-builder';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';

tmp.setGracefulCleanup();

export interface PutComponentVersionDto {
  tag: string;
  config: RawComponentConfig;
}

export default class ComponentRegister extends Command {
  static aliases = ['component:register', 'components:register', 'c:register', 'comp:register'];
  static description = 'Register a new Component with Architect Cloud';

  static flags = {
    ...Command.flags,
    arg: flags.string({
      description: 'Build arg(s) to pass to docker build',
      multiple: true,
    }),
    components: flags.string({
      char: 'c',
      description: 'Path to a component to build',
      multiple: true,
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
    await Docker.verify();

    const config_paths: Set<string> = new Set();

    if (args.component) {
      config_paths.add(path.resolve(untildify(args.component)));
    }

    if (flags.components) {
      for (let config_path of flags.components) {
        config_path = path.resolve(untildify(config_path));
        config_paths.add(config_path);
      }
    }

    if (config_paths.size <= 0) {
      throw new MissingContextError();
    }

    for (const config_path of config_paths) {
      await this.registerComponent(config_path, flags.tag);
    }
  }

  private async registerComponent(config_path: string, tag: string) {
    const { raw_config, file_path } = await ComponentConfigBuilder.rawFromPath(config_path);
    const component_path = path.dirname(file_path);

    if (!raw_config.name) {
      throw new Error('Component Config must have a name');
    }

    const account_name = raw_config.name.split('/')[0];
    const selected_account = await AccountUtils.getAccount(this.app.api, account_name);

    const tmpobj = tmp.dirSync({ mode: 0o750, prefix: Refs.safeRef(`${raw_config.name}:${tag}`), unsafeCleanup: true });
    let set_artifact_image = false;
    for (const [service_name, service_config] of Object.entries(raw_config.services || {})) {
      const image_tag = `${this.app.config.registry_host}/${raw_config.name}-${service_name}:${tag}`;
      const image = await this.pushImageIfNecessary(config_path, service_name, service_config, image_tag);
      service_config.image = image;

      for (const [module_name, module] of Object.entries(service_config.deploy?.modules || {})) {
        set_artifact_image = true;
        fs.copySync(path.resolve(component_path, untildify(module.path)), path.join(tmpobj.name, 'modules', service_name, module_name));
      }
    }
    if (set_artifact_image) {
      raw_config.artifact_image = await this.pushArtifact(`${this.app.config.registry_host}/${raw_config.name}:${tag}`, tmpobj.name);
    }

    tmpobj.removeCallback();

    for (const [task_name, task_config] of Object.entries(raw_config.tasks || {})) {
      const image_tag = `${this.app.config.registry_host}/${raw_config.name}-${task_name}:${tag}`;
      const image = await this.pushImageIfNecessary(config_path, task_name, task_config, image_tag);
      task_config.image = image;
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

  private async pushImageIfNecessary(config_path: string, service_name: string, service_config: RawServiceConfig, image_tag: string) {
    // if the image field is set, we just take their image as is
    if (service_config.image) {
      return service_config.image;
    }

    // pull cache and actual image if they exist
    try {
      await Docker.pullImage(Docker.toCacheTag(image_tag));
      /* eslint-disable-next-line no-empty */
    } catch {}
    try {
      await Docker.pullImage(image_tag);
      /* eslint-disable-next-line no-empty */
    } catch {}
    // build and push cache image
    const cache_image = await this.buildImage(config_path, service_name, service_config, Docker.toCacheTag(image_tag));
    await this.pushImage(cache_image);

    // otherwise we build and push the image to our repository
    const image = await this.buildImage(config_path, service_name, service_config, image_tag);
    await this.pushImage(image);
    const digest = await this.getDigest(image);

    // we don't need the tag on our image because we use the digest as the key
    const image_without_tag = Docker.stripTagFromImage(image);
    return `${image_without_tag}@${digest}`;
  }

  private async buildImage(config_path: string, service_name: string, service_config: RawServiceConfig, image_tag: string) {
    const { flags } = this.parse(ComponentRegister);

    const build_context = service_config?.build?.context;
    if (!build_context) {
      throw new Error(`Service ${service_name} does not specify an image or a build.context. It must contain one or the other.`);
    }
    try {
      const component_path = fs.lstatSync(config_path).isFile() ? path.dirname(config_path) : config_path;
      const build_path = path.resolve(component_path, untildify(build_context));
      let dockerfile;
      if (service_config.build?.dockerfile) {
        dockerfile = path.join(build_path, service_config.build.dockerfile);
      }
      let build_args: string[] = [];
      if (service_config.build?.args) {
        const build_args_map: Dictionary<string> = service_config.build?.args || {};
        for (const arg of flags.arg || []) {
          const [key, value] = arg.split('=');
          if (!value) {
            throw new Error(`--arg must be in the format key=value: ${arg}`);
          }
          build_args_map[key] = value;
        }
        build_args = Object.entries(build_args_map).map(([key, value]) => `${key}=${value}`);
      }
      return await Docker.buildImage(build_path, image_tag, dockerfile, build_args);
    } catch (err) {
      cli.action.stop(chalk.red(`Build failed`));
      this.log(`Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present`);
      throw new Error(err);
    }
  }

  private async pushImage(image: string) {
    cli.action.start(chalk.blue(`Pushing Docker image for ${image}`));
    try {
      await Docker.pushImage(image);
    } catch (err) {
      cli.action.stop(chalk.red(`Push failed for image ${image}`));
      throw new Error(err);
    }
    cli.action.stop();
    this.log(chalk.green(`Successfully pushed Docker image for ${image}`));
  }

  private async getDigest(image: string) {
    cli.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
    const digest = await Docker.getDigest(image).catch(err => {
      cli.action.stop(chalk.red(`Inspect failed`));
      throw new Error(err);
    });
    cli.action.stop();
    this.log(chalk.green(`Image verified`));
    return digest;
  }

  private async pushArtifact(image: string, folder: string) {
    this.log(chalk.blue(`Pushing artifact for ${image}`));
    const { stdout } = await oras(['push', image, '.'], { cwd: folder });
    const digest_match = new RegExp('Digest: (.*)').exec(stdout);
    if (digest_match) {
      const digest = digest_match[1];
      const image_without_tag = Docker.stripTagFromImage(image);
      return `${image_without_tag}@${digest}`;
    } else {
      throw new Error('Unable to get digest');
    }
  }
}
