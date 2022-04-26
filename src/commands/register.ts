import { CliUx, Flags } from '@oclif/core';
import chalk from 'chalk';
import { classToClass, classToPlain } from 'class-transformer';
import * as Diff from 'diff';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import tmp from 'tmp';
import untildify from 'untildify';
import { ArchitectError, buildSpecFromPath, ComponentSlugUtils, Dictionary, dumpToYml, resourceRefToNodeRef, ResourceSlugUtils, ResourceSpec, ServiceNode, Slugs } from '../';
import AccountUtils from '../architect/account/account.utils';
import Command from '../base-command';
import LocalDependencyManager from '../common/dependency-manager/local-manager';
import { DockerComposeUtils } from '../common/docker-compose';
import DockerComposeTemplate from '../common/docker-compose/template';
import * as Docker from '../common/utils/docker';
import DockerBuildXUtils from '../common/utils/docker-buildx.utils';
import { IF_EXPRESSION_REGEX } from '../dependency-manager/spec/utils/interpolation';
import AppConfig from '../app-config/config';

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
    tag: Flags.string({
      char: 't',
      description: 'Tag to give to the new component',
      default: 'latest',
    }),
  };

  static args = [{
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
    const start_time = Date.now();

    // here we validate spec and config, but only need to send the spec to the API so we don't need the resulting config
    const component_spec = buildSpecFromPath(config_path);

    if (!component_spec.name) {
      throw new Error('Component Config must have a name');
    }

    const { component_account_name, component_name } = ComponentSlugUtils.parse(component_spec.name);
    const selected_account = await AccountUtils.getAccount(this.app, component_account_name || flags.account);

    const dependency_manager = new LocalDependencyManager(
      this.app.api,
      { [component_spec.name]: config_path }
    );
    dependency_manager.environment = 'production';
    dependency_manager.account = selected_account.name;

    const loaded_spec = await dependency_manager.loadComponentSpec(component_spec.name);
    const graph = await dependency_manager.getGraph([loaded_spec], undefined, false, false);
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
    // Set image name in compose
    for (const [service_name, service] of Object.entries(full_compose.services)) {
      if (service.build && !service.image && service.labels) {
        const ref_label = service.labels.find(label => label.startsWith('architect.ref='));
        if (!ref_label) { continue; }
        const ref = ref_label.replace('architect.ref=', '');
        const { component_account_name, component_name, resource_type, resource_name } = ResourceSlugUtils.parse(ref);
        const ref_with_account = ResourceSlugUtils.build(component_account_name || selected_account.name, component_name, resource_type, resource_name);

        const image = `${this.app.config.registry_host}/${ref_with_account}:${tag}`;

        if (service.build) {
          delete service.build.args;
        }

        if (DockerBuildXUtils.isMacM1Machine()) {
          const bakePlatforms: any = {
            "x-bake": { "platforms": DockerBuildXUtils.getPlatforms() },
          };
          service.build = { ...service.build, ...bakePlatforms };
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

    await DockerBuildXUtils.writeCompose(compose_file, yaml.dump(compose));

    let build_args: string[] = [];
    for (const service_config of Object.values(component_spec.services || {})) {
      build_args = build_args.concat((await this.getBuildArgs(service_config)).map(arg => {
        return `${arg}`;
      }));
    }

    build_args = build_args.filter((value, index, self) => {
      return self.indexOf(value) === index;
    }).reduce((arr, value) => {
      arr.push("--set");
      arr.push(`*.args.${value}`);
      return arr;
    }, [] as string[]);

    try {
      const is_local = this.app.config.api_host.includes("localhost");
      if (is_local) {
        // Create a configuration file for buildkitd
        const local_buildkitd_config_file = "buildkitd.toml";
        const file_content = `[registry."${this.app.config.registry_host}"]\n  http = true\n  insecure = true`;
        await DockerBuildXUtils.writeBuildkitdConfigFile(local_buildkitd_config_file, file_content);
    
        await DockerBuildXUtils.dockerBuildX(["create", "--name", "architect", "--driver-opt", "network=host", "--use", "--buildkitd-flags", "--allow-insecure-entitlement security.insecure", `--config=${local_buildkitd_config_file}`], {
          stdio: "inherit",
        });
      } else {
        await DockerBuildXUtils.dockerBuildX(["create", "--name", "architect"], {
          stdio: "inherit",
        });
      }
    } catch (err: any) {
      this.log(`Docker builder instance 'architect' already exists. Using existing 'architect' builder instance ...`);
    }

    try {
      await DockerBuildXUtils.dockerBuildX(["inspect", "--bootstrap"], {
        stdio: "inherit",
      });
    } catch (err: any) {
      fs.removeSync(compose_file);
      this.log(`Docker buildx failed to inspect`);
      this.error(err);
    }

    try {
      await DockerBuildXUtils.dockerBuildX(["bake", "-f", compose_file, "--push", ...build_args, "--builder", "architect"], {
        stdio: "inherit",
      });
    } catch (err: any) {
      fs.removeSync(compose_file);
      this.log(`Docker buildx bake failed`);
      this.error(err);
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

    console.log("Time: " + (Date.now() - start_time));
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

  private async getDigest(image: string) {
    CliUx.ux.action.start(chalk.blue(`Running \`docker inspect\` on the given image: ${image}`));
    const digest = await Docker.getDigest(image).catch(err => {
      CliUx.ux.action.stop(chalk.red(`Inspect failed`));
      throw err;
    });
    CliUx.ux.action.stop();
    this.log(chalk.green(`Image verified`));
    return digest;
  }
}
