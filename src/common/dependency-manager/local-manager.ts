import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import DependencyManager, { ComponentSlugUtils, ComponentVersionSlugUtils, ServiceSpec, TaskSpec } from '../../dependency-manager/src';
import { buildComponentRef, ComponentConfig, ComponentInstanceMetadata } from '../../dependency-manager/src/config/component-config';
import DependencyGraph from '../../dependency-manager/src/graph';
import { buildConfigFromPath, buildConfigFromYml, buildSpecFromYml } from '../../dependency-manager/src/spec/utils/component-builder';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import PortUtil from '../utils/port';

interface ComponentConfigOpts {
  map_all_interfaces: boolean;
}

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

  async loadComponentConfig(component_string: string, interfaces?: Dictionary<string[]>, options?: ComponentConfigOpts): Promise<ComponentConfig> {
    const merged_options = {
      ...{
        map_all_interfaces: false,
      }, ...options,
    };

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
    const merged_spec = buildSpecFromYml(config.source_yml);

    const inverted_interfaces: Dictionary<string> = {};
    for (const [interface_from, interface_to] of Object.entries(interfaces || {})) {
      for (const to of interface_to) { // TODO: add test for this update?
        inverted_interfaces[to] = interface_from;
      }
    }

    for (const [interface_to, interface_obj] of Object.entries(config.interfaces)) {
      const interface_from = inverted_interfaces[interface_to];

      // If the interface hasn't been explictely mapped and we aren't configured
      // to implicitely map all interfaces, then just skip this interface
      if (!interface_from && !merged_options.map_all_interfaces) {
        continue;
      }

      if (!interface_obj.ingress) {
        interface_obj.ingress = {};
      }
      interface_obj.ingress.enabled = true;

      // If interface_from has a value, then it was manually mapped by the user, and we
      // should set that value while building the interface object. If interface_from
      // is undefined, we should build the interface object using the config defaults
      if (interface_from) {
        interface_obj.ingress.subdomain = interface_from;
      } else if (!interface_obj.ingress.subdomain) {
        interface_obj.ingress.subdomain = interface_to;
      }
      // TODO:269:new-ticket find way to avoid modifying source_yml - def non-trivial with interpolation
      // potentially create a "deployConfig": a merged source_yml prior to interpolation
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      merged_spec.interfaces[interface_to] = interface_obj;
    }

    if (config.instance_metadata?.local_path && !this.production) {
      const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: deepmerge.Options) => sourceArray;

      for (const [sk, sv] of Object.entries(config.services)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (sv.debug) {
          config.services[sk] = deepmerge(sv, sv.debug, { arrayMerge: overwriteMerge });
        }
      }
      for (const [tk, tv] of Object.entries(config.tasks)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (tv.debug) {
          config.tasks[tk] = deepmerge(tv, tv.debug, { arrayMerge: overwriteMerge });
        }
      }

      const services: Dictionary<ServiceSpec> = {};
      for (const [sk, sv] of Object.entries(merged_spec.services || {})) {
        services[sk] = deepmerge(sv, sv.debug || {}, { arrayMerge: overwriteMerge });
      }

      // TODO:285: add test for task debug block
      const tasks: Dictionary<TaskSpec> = {};
      for (const [sk, sv] of Object.entries(merged_spec.tasks || {})) {
        tasks[sk] = deepmerge(sv, sv.debug || {}, { arrayMerge: overwriteMerge });
      }

      merged_spec.services = services;
      merged_spec.tasks = tasks;
    }
    config.source_yml = yaml.dump(merged_spec);

    return config;
  }

  async loadComponentConfigs(initial_component: ComponentConfig): Promise<ComponentConfig[]> {
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

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string | null>> = {}, interpolate = true, validate = true): Promise<DependencyGraph> {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_configs, values, interpolate, validate, external_addr);
  }
}
