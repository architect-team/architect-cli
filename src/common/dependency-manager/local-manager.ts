import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import { ValidationError } from 'class-validator';
import DependencyManager, { ComponentVersionSlugUtils } from '../../dependency-manager/src';
import { buildFromPath, buildFromYml } from '../../dependency-manager/src/schema/component-builder';
import { ComponentConfig } from '../../dependency-manager/src/schema/config/component-config';
import { ComponentConfigBuilder } from '../../dependency-manager/src/spec/component/component-builder';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../../dependency-manager/src/utils/errors';
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
    const component_slug = `${component_account_name}/${component_name}`;
    const component_ref = `${component_slug}:${tag}`;

    let config: ComponentConfig;
    // Load locally linked component config
    if (component_slug in this.linked_components) {
      if (process.env.NODE_ENV !== 'test') {
        console.log(`Using locally linked ${chalk.blue(component_slug)} found at ${chalk.blue(this.linked_components[component_slug])}`);
      }
      config = await buildFromPath(this.linked_components[component_slug]);
      config.extends = `file:${this.linked_components[component_slug]}`;
    } else {
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${component_account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}\n${err.message}`;
        throw err;
      });
      config = buildFromYml(component_version.config);
    }

    // Set the tag
    // TODO:269:? why do these get set out here, why not in transform?
    config.name = component_slug;
    config.tag = tag;
    config.instance_name = instance_name;
    config.instance_id = config.ref;

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
    }

    if (config.local_path && !this.production) {
      // Set debug values
      for (const [sk, sv] of Object.entries(config.services)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (sv.debug) {
          config.services[sk] = sv.merge(sv.debug); // TODO:269:merge
        }
      }
      for (const [tk, tv] of Object.entries(config.tasks)) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        if (tv.debug) {
          config.tasks[tk] = tv.merge(tv.debug); // TODO:269:merge
        }
      }
    }

    return config;
  }

  async loadComponentConfigs(initial_component: ComponentConfig) {
    const component_configs = [];
    const component_configs_queue = [initial_component];
    const loaded_components = new Set();
    while (component_configs_queue.length) {
      const component_config = component_configs_queue.pop();
      if (!component_config) { break; }
      if (loaded_components.has(component_config.ref)) {
        continue;
      }
      loaded_components.add(component_config.ref);
      component_configs.push(component_config);

      for (const [dep_name, dep_tag] of Object.entries(component_config.dependencies)) {
        const dep_component_config = await this.loadComponentConfig(`${dep_name}:${dep_tag}`);
        component_configs_queue.push(dep_component_config);
      }
    }
    return component_configs;
  }

  async validateComponent(component: ComponentConfig, context: object, ignore_keys: string[]): Promise<[ComponentConfig, ValidationError[]]> {
    const groups = ['deploy', 'developer'];
    const [interpolated_component, errors] = await super.validateComponent(component, context, ignore_keys, groups);
    const component_extends = component.getExtends();
    if (component_extends?.startsWith('file:') && errors.length) {
      const component_path = component_extends.substr('file:'.length);
      const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return [interpolated_component, errors];
  }

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string | null>> = {}, interpolate = true) {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_configs, values, interpolate, external_addr);
  }
}
