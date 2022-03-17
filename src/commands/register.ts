import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import { classToPlain } from 'class-transformer';
import * as Diff from 'diff';
import fs from 'fs-extra';
import isCi from 'is-ci';
import yaml from 'js-yaml';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import AccountUtils from '../architect/account/account.utils';
import Command from '../base-command';
import LocalDependencyManager, { ComponentConfigOpts } from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import MissingContextError from '../common/errors/missing-build-context';
import DeployUtils from '../common/utils/deploy.utils';
import * as Docker from '../common/utils/docker';
import { oras } from '../common/utils/oras';
import { ArchitectError, ComponentSlugUtils, ComponentSpec, ComponentVersionSlugUtils, ResourceSlugUtils, ResourceSpec, ServiceNode, Slugs, TaskNode } from '../dependency-manager/src';
import { buildSpecFromPath, dumpToYml } from '../dependency-manager/src/spec/utils/component-builder';
import { Dictionary } from '../dependency-manager/src/utils/dictionary';

tmp.setGracefulCleanup();

export default class ComponentRegister extends Command {
  static aliases = ['component:register', 'components:register', 'c:register', 'comp:register'];
  static description = 'Register a new Component with Architect Cloud';

  static flags = {
    ...Command.flags,
    ...AccountUtils.flags,
    arg: Flags.string({
      description: 'Build arg(s) to pass to docker build',
      multiple: true,
    }),
    components: Flags.string({
      char: 'c',
      description: 'Path to a component to build',
      multiple: true,
      hidden: true,
    }),
    tag: Flags.string({
      char: 't',
      description: 'Tag to give to the new component',
      default: 'latest',
    }),
  };

  static args = [{
    name: 'component',
    description: 'Path to a component to register',
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ComponentRegister);
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

    if (!Slugs.ComponentTagValidator.test(flags.tag)) {
      throw new ArchitectError(Slugs.ComponentTagDescription);
    }

    for (const config_path of config_paths) {
      await this.registerComponent(config_path, flags.tag);
    }
  }

  private async registerComponent(config_path: string, tag: string) {
    const { flags } = await this.parse(ComponentRegister);

    // here we validate spec and config, but only need to send the spec to the API so we don't need the resulting config
    const component_spec = buildSpecFromPath(config_path);

    const new_spec = component_spec;

    if (!new_spec.name) {
      throw new Error('Component Config must have a name');
    }

    const { component_account_name, component_name } = ComponentSlugUtils.parse(new_spec.name);
    const selected_account = await AccountUtils.getAccount(this.app, component_account_name || flags.account);

    const interfaces_map = undefined;
    const component_secrets = DeployUtils.getComponentSecrets([]);

    const linked_components = this.app.linkedComponents;
    const component_versions: string[] = [];
    for (const config_or_component of [config_path]) {
      let component_version = config_or_component;
      // Load architect.yml if passed
      if (!ComponentVersionSlugUtils.Validator.test(config_or_component) && !ComponentSlugUtils.Validator.test(config_or_component)) {
        const res = buildSpecFromPath(config_or_component);
        linked_components[res.name] = config_or_component;
        component_version = res.name;
      }
      component_versions.push(component_version);
    }

    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      this.app.linkedComponents
    );

    dependency_manager.account = selected_account.name;

    const component_specs: ComponentSpec[] = [];
    const component_options: ComponentConfigOpts = { map_all_interfaces: true, interfaces: interfaces_map, bypass_locally_linked_sources: true };

    for (const component_version of component_versions) {
      const component_config = await dependency_manager.loadComponentSpec(component_version, component_options);
      component_specs.push(component_config);
    }
    const graph = await dependency_manager.getGraph(component_specs, component_secrets, true, false);
    const compose = await DockerComposeUtils.generate(graph);

    const project_name = 'register';
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await fs.ensureFile(compose_file);
    await fs.writeFile(compose_file, yaml.dump(compose));

    let build_args: string[] = [];
    for (const [service_name, service_config] of Object.entries(new_spec.services || {})) {
      build_args = build_args.concat((await this.getBuildArgs(service_config)).map(arg => {
        return `${arg}`;
      }));
      if (isCi) {
        const ref = ResourceSlugUtils.build(selected_account.name, component_name, service_config instanceof ServiceNode ? 'services' : 'tasks', service_name);
        await Docker.pullImage(Docker.toCacheImage(`${this.app.config.registry_host}/${ref}:${tag}`));
      }
    }
    build_args = build_args.filter((value, index, self) => {
      return self.indexOf(value) === index;
    }).reduce((arr, value) => {
      arr.push('--build-arg');
      arr.push(value);
      return arr;
    }, [] as string[]);

    try {
      await DockerComposeUtils.dockerCompose(['-f', compose_file, 'build', ...build_args], {
        stdout: process.stdout,
        stderr: process.stderr,
      });
    } catch (err: any) {
      CliUx.ux.action.stop(chalk.red(`Build failed`));
      this.log(`Docker build failed. If an image is not specified in your component spec, then a Dockerfile must be present`);
      throw new Error(err);
    }

    const images = new Map<string, string>();
    CliUx.ux.action.start(chalk.blue(`Uploading images ${new_spec.name}:${tag} with Architect Cloud...`));
    for (const node of graph.nodes) {
      if (!(node instanceof ServiceNode) && !(node instanceof TaskNode)) {
        continue;
      }
      if (!node.config.build.args && !node.config.build.context && !node.config.build.dockerfile && !node.config.build.target) {
        continue;
      }
      const name_parts = node.ref.split('--');
      if (name_parts.length != 2) {
        continue;
      }
      const ref = ResourceSlugUtils.build(selected_account.name, component_name, node instanceof ServiceNode ? 'services' : 'tasks', name_parts[1]);
      const name = `${this.app.config.registry_host}/${ref}:${tag}`;
      await Docker.tagImage(`docker-compose_${node.ref}`, name);
      await this.pushImage(name);
      if (isCi) {
        await this.pushImage(Docker.toCacheImage(name));
      }
      const digest = await this.getDigest(name);

      // we don't need the tag on our image because we use the digest as the key
      const image_without_tag = Docker.stripTagFromImage(name);
      images.set(name_parts[1], `${image_without_tag}@${digest}`);
    }
    CliUx.ux.action.stop();

    if (new_spec.services) {
      for (const service_name of Object.keys(new_spec.services)) {
        delete new_spec.services[service_name].debug; // we don't need to compare the debug block for remotely-deployed components
        if (images.has(service_name)) {
          new_spec.services[service_name].image = images.get(service_name);
        }
      }
    }

    const config = classToPlain(new_spec);
    delete config.metadata;
    const component_dto = {
      tag: tag,
      config: config,
    };

    let previous_config_data;
    try {
      previous_config_data = (await this.app.api.get(`/accounts/${selected_account.name}/components/${component_name}/versions/${tag || 'latest'}`)).data.config;
      /* eslint-disable-next-line no-empty */
    } catch { }

    this.log(chalk.blue(`Begin component config diff`));
    const previous_source_yml = dumpToYml(previous_config_data, { lineWidth: -1 });

    const new_source_yml = dumpToYml(component_dto.config, { lineWidth: -1 });
    const component_config_diff = Diff.diffLines(previous_source_yml, new_source_yml);
    for (const diff_section of component_config_diff) {
      const line_parts = diff_section.value.split('\n');
      line_parts.pop(); // last element will be a newline that we don't want
      for (const line_part of line_parts) {
        if (diff_section.added) {
          process.stdout.write(chalk.green(`+ ${line_part}`));
        } else if (diff_section.removed) {
          process.stdout.write(chalk.red(`- ${line_part}`));
        } else {
          process.stdout.write(chalk.grey(`  ${line_part}`));
        }
        process.stdout.write('\n');
      }
    }
    this.log(chalk.blue(`End component config diff`));

    CliUx.ux.action.start(chalk.blue(`Registering component ${new_spec.name}:${tag} with Architect Cloud...`));
    await this.app.api.post(`/accounts/${selected_account.id}/components`, component_dto);
    CliUx.ux.action.stop();
    this.log(chalk.green(`Successfully registered component`));
  }

  private async getBuildArgs(resource_spec: ResourceSpec): Promise<string[]> {
    const { flags } = await this.parse(ComponentRegister);

    const build_args_map: Dictionary<string | null> = { ...resource_spec.build?.args };
    for (const arg of flags.arg || []) {
      const [key, value] = arg.split(/=([^]+)/);
      if (!value) {
        throw new Error(`--arg must be in the format key=value: ${arg}`);
      }
      build_args_map[key] = value;
    }
    return Object.entries(build_args_map).map(([key, value]) => `${key}=${value}`);
  }

  private async pushImage(image: string) {
    CliUx.ux.action.start(chalk.blue(`Pushing Docker image for ${image}`));
    try {
      await Docker.pushImage(image);
    } catch (err: any) {
      CliUx.ux.action.stop(chalk.red(`Push failed for image ${image}`));
      throw new Error(err);
    }
    CliUx.ux.action.stop();
    this.log(chalk.green(`Successfully pushed Docker image for ${image}`));
  }

  private async getDigest(image: string) {
    CliUx.ux.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
    const digest = await Docker.getDigest(image).catch(err => {
      CliUx.ux.action.stop(chalk.red(`Inspect failed`));
      throw new Error(err);
    });
    CliUx.ux.action.stop();
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
