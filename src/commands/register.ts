import { CliUx, Flags } from '@oclif/core';
import axios from 'axios';
import chalk from 'chalk';
import { classToClass, classToPlain } from 'class-transformer';
import * as Diff from 'diff';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import hash from 'object-hash';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import { ArchitectError, buildSpecFromPath, ComponentSlugUtils, Dictionary, dumpToYml, resourceRefToNodeRef, ResourceSlugUtils, ServiceNode, Slugs, validateInterpolation } from '../';
import AccountUtils from '../architect/account/account.utils';
import BaseCommand from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import * as Docker from '../common/utils/docker';
import { docker } from '../common/utils/docker';
import DockerBuildXUtils from '../common/utils/docker-buildx.utils';
import { IF_EXPRESSION_REGEX } from '../dependency-manager/spec/utils/interpolation';

tmp.setGracefulCleanup();

export default class ComponentRegister extends BaseCommand {
  static aliases = ['component:register', 'components:register', 'c:register', 'comp:register'];
  static description = 'Register a new Component with Architect Cloud';

  static flags = {
    ...BaseCommand.flags,
    ...AccountUtils.flags,
    arg: {
      non_sensitive: true,
      ...Flags.string({
        description: 'Build arg(s) to pass to docker build',
        multiple: true,
      }),
    },
    tag: {
      non_sensitive: true,
      ...Flags.string({
        char: 't',
        description: 'Tag to give to the new component',
        default: 'latest',
      }),
    },
    architecture: {
      non_sensitive: true,
      ...Flags.string({
        description: 'Architecture(s) to target for Docker image builds',
        default: ['amd64'],
        multiple: true,
      }),
    },
    'cache-directory': {
      non_sensitive: true,
      ...Flags.string({
        description: 'Directory to write build cache to',
      }),
    },
  };

  static args = [{
    non_sensitive: true,
    name: 'component',
    description: 'Path to a component to register',
    default: './',
  }];

  async run(): Promise<void> {
    const { flags, args } = await this.parse(ComponentRegister);
    await Docker.verify();

    const config_path = path.resolve(untildify(args.component));

    if (!Slugs.ComponentTagValidator.test(flags.tag)) {
      throw new ArchitectError(Slugs.ComponentTagDescription);
    }

    await this.registerComponent(config_path, flags.tag);
  }

  private async registerComponent(config_path: string, tag: string) {
    const { flags } = await this.parse(ComponentRegister);
    console.time('Time');

    // here we validate spec and config, but only need to send the spec to the API so we don't need the resulting config
    const component_spec = buildSpecFromPath(config_path);

    if (!component_spec.name) {
      throw new Error('Component Config must have a name');
    }

    const context = {
      architect: {
        build: {
          tag: flags.tag,
        },
      },
    };

    validateInterpolation(component_spec);

    const { component_account_name, component_name } = ComponentSlugUtils.parse(component_spec.name);
    const selected_account = await AccountUtils.getAccount(this.app, component_account_name || flags.account);

    const dependency_manager = new LocalDependencyManager(this.app.api);
    dependency_manager.environment = 'production';
    dependency_manager.account = selected_account.name;

    const graph = await dependency_manager.getGraph([classToClass(component_spec)], undefined, { interpolate: false, validate: false });
    // Tmp fix to register host overrides
    for (const node of graph.nodes.filter(n => n instanceof ServiceNode) as ServiceNode[]) {
      for (const interface_config of Object.values(node.interfaces)) {
        delete interface_config?.host;
      }
    }
    const full_compose = await DockerComposeUtils.generate(graph);

    const compose: DockerComposeTemplate = {
      version: '3',
      services: {},
      volumes: {},
    };
    const image_mapping: Dictionary<string | undefined> = {};

    const seen_cache_dir = new Set<string>();

    // Set image name in compose
    for (const [service_name, service] of Object.entries(full_compose.services)) {
      if (service.build && !service.image && service.labels) {
        const ref_label = service.labels.find(label => label.startsWith('architect.ref='));
        if (!ref_label) { continue; }
        const ref = ref_label.replace('architect.ref=', '');
        const { component_account_name, component_name, resource_type, resource_name } = ResourceSlugUtils.parse(ref);
        const ref_with_account = ResourceSlugUtils.build(component_account_name || selected_account.name, component_name, resource_type, resource_name);

        const image = `${this.app.config.registry_host}/${ref_with_account}:${tag}`;

        const buildx_platforms: string[] = DockerBuildXUtils.convertToBuildxPlatforms(flags['architecture']);

        service.build['x-bake'] = {
          platforms: buildx_platforms,
          pull: false,
        };

        if (flags['cache-directory']) {
          // Cache directory needs to be unique per dockerfile: https://github.com/docker/build-push-action/issues/252#issuecomment-744412763
          const cache_dir = path.join(flags['cache-directory'], hash(service.build));

          // To test you need to prune the buildx cache
          // docker buildx prune --builder architect --force
          service.build['x-bake']['cache-from'] = `type=local,src=${cache_dir}`;

          if (!seen_cache_dir.has(cache_dir)) {
            // https://docs.docker.com/engine/reference/commandline/buildx_build/#cache-to
            service.build['x-bake']['cache-to'] = `type=local,dest=${cache_dir}-tmp,mode=max`;
          }
          seen_cache_dir.add(cache_dir);
        }

        compose.services[service_name] = {
          build: service.build,
          image: image,
        };
        image_mapping[ref_with_account] = image;
      }
    }

    const project_name = `register.${resourceRefToNodeRef(component_spec.name)}.${tag}`;
    const compose_file = DockerComposeUtils.buildComposeFilepath(this.app.config.getConfigDir(), project_name);

    await DockerComposeUtils.writeCompose(compose_file, yaml.dump(compose));

    const args = flags.arg || [];

    for (const arg of args) {
      const [key, value] = arg.split(/=([^]+)/);
      if (!value) {
        throw new Error(`--arg must be in the format key=value: ${arg}`);
      }
    }

    const build_args = args.filter((value, index, self) => {
      return self.indexOf(value) === index;
    }).reduce((arr, value) => {
      arr.push('--set');
      arr.push(`*.args.${value}`);
      return arr;
    }, [] as string[]);

    const builder = await DockerBuildXUtils.getBuilder(this.app.config);

    try {
      await DockerBuildXUtils.dockerBuildX(['bake', '-f', compose_file, '--load', ...build_args], builder, {
        stdio: 'inherit',
      });
    } catch (err: any) {
      fs.removeSync(compose_file);
      this.log(`Docker buildx bake failed. Please make sure docker is running.`);
      this.error(err);
    }

    for (const image of Object.values(image_mapping) as string[]) {
      await docker(['push', image]);
    }

    for (const cache_dir of seen_cache_dir) {
      await fs.move(`${cache_dir}-tmp`, cache_dir, { overwrite: true });
    }

    const new_spec = classToClass(component_spec);
    for (const [service_name, service] of Object.entries(new_spec.services || {})) {
      if (IF_EXPRESSION_REGEX.test(service_name)) { continue; }

      delete service.debug; // we don't need to compare the debug block for remotely-deployed components

      const ref = ResourceSlugUtils.build(component_account_name || selected_account.name, component_name, 'services', service_name);
      const image = image_mapping[ref];
      if (image) {
        const digest = await this.getDigest(image);
        // we don't need the tag on our image because we use the digest as the key
        const image_without_tag = Docker.stripTagFromImage(image);
        service.image = `${image_without_tag}@${digest}`;
      }
      if (!service.image) {
        this.error(`Failed to register service ${service_name}. No image found.`);
      }
    }
    for (const [task_name, task] of Object.entries(new_spec.tasks || {})) {
      if (IF_EXPRESSION_REGEX.test(task_name)) { continue; }

      delete task.debug; // we don't need to compare the debug block for remotely-deployed components

      const ref = ResourceSlugUtils.build(component_account_name || selected_account.name, component_name, 'tasks', task_name);
      const image = image_mapping[ref];
      if (image) {
        const digest = await this.getDigest(image);
        // we don't need the tag on our image because we use the digest as the key
        const image_without_tag = Docker.stripTagFromImage(image);
        task.image = `${image_without_tag}@${digest}`;
      }
      if (!task.image) {
        this.error(`Failed to register task ${task_name}. No image found.`);
      }
    }

    const config = classToPlain(new_spec);
    delete config.metadata;
    const component_dto = {
      tag,
      config,
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

    console.timeEnd('Time');
  }

  private async getDigest(image: string) {
    const token_json = await this.app.auth.getPersistedTokenJSON();

    const protocol = DockerBuildXUtils.isLocal(this.app.config) ? 'http' : 'https';
    const registry_client = axios.create({
      baseURL: `${protocol}://${this.app.config.registry_host}/v2`,
      headers: {
        Authorization: `${token_json?.token_type} ${token_json?.access_token}`,
        Accept: 'application/vnd.docker.distribution.manifest.v2+json',
      },
      timeout: 10000,
    });

    const image_name = image.replace(this.app.config.registry_host, '');
    const [name, tag] = image_name.split(':');

    const { headers } = await registry_client.head(`${name}/manifests/${tag}`);
    return headers['docker-content-digest'];
  }
}
