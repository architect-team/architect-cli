import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import DependencyManager, { ComponentSlugUtils, ComponentVersionSlugUtils, ServiceSpec, TaskSpec, validateOrRejectSpec } from '../../dependency-manager/src';
import { buildConfigFromPath, buildConfigFromYml, loadSpecFromPathOrReject, parseSourceYml } from '../../dependency-manager/src/schema/component-builder';
import { buildComponentRef, ComponentConfig, ComponentInstanceMetadata } from '../../dependency-manager/src/schema/config/component-config';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationError, ValidationErrors } from '../../dependency-manager/src/utils/errors';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;
  use_sidecar = false;
  production = false;

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}, production = false) {
    super();
    this.api = api;
    this.linked_components = linked_components;
    this.production = production;
  }

  async loadComponentConfig(component_string: string, interfaces?: Dictionary<string>): Promise<ComponentConfig> {
    const { component_account_name, component_name, tag, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const component_slug = ComponentSlugUtils.build(component_account_name, component_name);
    const component_ref = ComponentVersionSlugUtils.build(component_account_name, component_name, tag, instance_name);

    let config: ComponentConfig;
    const instance_metadata: ComponentInstanceMetadata = {
      instance_name,
      instance_id: component_ref,
      instance_date: new Date(),
    };
    // Load locally linked component config
    if (component_slug in this.linked_components) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Using locally linked ${chalk.blue(component_slug)} found at ${chalk.blue(this.linked_components[component_slug])}`);
      }
      const { component_config } = buildConfigFromPath(this.linked_components[component_slug], tag);
      config = component_config;
      instance_metadata.local_path = this.linked_components[component_slug];
    } else {
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${component_account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}\n${err.message}`;
        throw err;
      });

      const config_yaml = yaml.dump(component_version.config);
      config = buildConfigFromYml(config_yaml, tag);
    }

    config.instance_metadata = instance_metadata;

    // Set debug values
    const parsed_yml = parseSourceYml(config.source_yml);
    const merged_spec = validateOrRejectSpec(parsed_yml);

    for (const [interface_from, interface_to] of Object.entries(interfaces || {})) {
      const interface_obj = config.interfaces[interface_to];
      if (!interface_obj) {
        throw new Error(`${component_ref} does not have an interface named ${interface_to}`);
      }
      if (!interface_obj.ingress) {
        interface_obj.ingress = {};
      }
      interface_obj.ingress.subdomain = interface_from;
      interface_obj.ingress.enabled = true;
      config.interfaces[interface_to] = interface_obj;

      // TODO:269 find way to avoid modifying source_yml - def non-trivial with interpolation
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      merged_spec.interfaces[interface_to] = interface_obj;
    }

    if (config.instance_metadata?.local_path && !this.production) {
      for (const [sk, sv] of Object.entries(config.services)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (sv.debug) {
          config.services[sk] = deepmerge(sv, sv.debug);
        }
      }
      for (const [tk, tv] of Object.entries(config.tasks)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (tv.debug) {
          config.tasks[tk] = deepmerge(tv, tv.debug);
        }
      }

      const services: Dictionary<ServiceSpec> = {};
      for (const [sk, sv] of Object.entries(merged_spec.services || {})) {
        services[sk] = deepmerge(sv, sv.debug || {});
      }

      // TODO:269 add test for task debug block
      const tasks: Dictionary<TaskSpec> = {};
      for (const [sk, sv] of Object.entries(merged_spec.tasks || {})) {
        tasks[sk] = deepmerge(sv, sv.debug || {});
      }

      merged_spec.services = services;
      merged_spec.tasks = tasks;
    }
    config.source_yml = yaml.dump(merged_spec);

    return config;
  }

  async loadComponentConfigs(initial_component: ComponentConfig) {
    const component_configs = [];
    const component_configs_queue = [initial_component];
    const loaded_components = new Set();
    while (component_configs_queue.length) {
      const component_config = component_configs_queue.pop();
      if (!component_config) { break; }
      const ref = buildComponentRef(component_config);
      if (loaded_components.has(ref)) {
        continue;
      }
      loaded_components.add(ref);
      component_configs.push(component_config);

      for (const [dep_name, dep_tag] of Object.entries(component_config.dependencies)) {
        const dep_component_config = await this.loadComponentConfig(`${dep_name}:${dep_tag}`);
        component_configs_queue.push(dep_component_config);
      }
    }
    return component_configs;
  }

  async validateComponent(component: ComponentConfig): Promise<[ComponentConfig, ValidationError[]]> {
    const [validated_component, errors] = await super.validateComponent(component);
    if (component.instance_metadata?.local_path?.startsWith('file:') && errors.length) {
      const component_path = component.instance_metadata.local_path.substr('file:'.length);
      const { file_path, file_contents } = loadSpecFromPathOrReject(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return [validated_component, errors];
  }

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string | null>> = {}, interpolate = true) {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_configs, values, interpolate, external_addr);
  }
}
