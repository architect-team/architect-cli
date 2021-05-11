import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import DependencyManager, { ComponentVersionSlugUtils } from '../../dependency-manager/src';
import { ComponentConfigBuilder } from '../../dependency-manager/src/spec/component/component-builder';
import { ComponentConfig } from '../../dependency-manager/src/spec/component/component-config';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../../dependency-manager/src/utils/errors';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  linked_components: Dictionary<string>;
  use_sidecar = false;

  constructor(api: AxiosInstance, linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.linked_components = linked_components;
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
      config = await ComponentConfigBuilder.buildFromPath(this.linked_components[component_slug]);
      config.setExtends(`file:${this.linked_components[component_slug]}`);
    } else {
      // Load remote component config
      const { data: component_version } = await this.api.get(`/accounts/${component_account_name}/components/${component_name}/versions/${tag}`).catch((err) => {
        err.message = `Could not download component for ${component_ref}\n${err.message}`;
        throw err;
      });
      config = ComponentConfigBuilder.buildFromJSON(component_version.config);
    }

    // Set the tag
    config.setName(component_ref);
    config.setInstanceName(instance_name);
    config.setInstanceId(config.getRef());

    for (const [interface_from, interface_to] of Object.entries(interfaces || {})) {
      const interface_obj = config.getInterfaces()[interface_to];
      if (!interface_obj) {
        throw new Error(`${component_ref} does not have an interface named ${interface_to}`);
      }
      interface_obj.external_name = interface_from;
      config.setInterface(interface_to, interface_obj);
    }

    if (config.getLocalPath()) {
      // Set debug values
      for (const [sk, sv] of Object.entries(config.getServices())) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        const debug_options = sv.getDebugOptions();
        if (debug_options) {
          config.setService(sk, sv.merge(debug_options));
        }
      }
      for (const [tk, tv] of Object.entries(config.getTasks())) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        const debug_options = tv.getDebugOptions();
        if (debug_options) {
          config.setTask(tk, tv.merge(debug_options));
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
      if (loaded_components.has(component_config.getRef())) {
        continue;
      }
      loaded_components.add(component_config.getRef());
      component_configs.push(component_config);

      for (const [dep_name, dep_tag] of Object.entries(component_config.getDependencies())) {
        const dep_component_config = await this.loadComponentConfig(`${dep_name}:${dep_tag}`);
        component_configs_queue.push(dep_component_config);
      }
    }
    return component_configs;
  }

  validateComponent(component: ComponentConfig, context: object, ignore_keys: string[]) {
    const errors = super.validateComponent(component, context, ignore_keys);
    const component_extends = component.getExtends();
    if (component_extends?.startsWith('file:') && errors.length) {
      const component_path = component_extends.substr('file:'.length);
      const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return errors;
  }

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string>> = {}) {
    const gateway_port = await PortUtil.getAvailablePort(80);
    const external_addr = `arc.localhost:${gateway_port}`;
    return super.getGraph(component_configs, values, external_addr);
  }
}
