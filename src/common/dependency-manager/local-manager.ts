import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DependencyNode, EnvironmentConfig, EnvironmentConfigBuilder, Refs } from '../../dependency-manager/src';
import { ComponentConfig } from '../../dependency-manager/src/component-config/base';
import { ComponentConfigBuilder } from '../../dependency-manager/src/component-config/builder';
import DependencyGraph from '../../dependency-manager/src/graph';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../../dependency-manager/src/utils/errors';
import { readIfFile } from '../../dependency-manager/src/utils/files';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  config_path: string;
  linked_components: Dictionary<string>;

  protected constructor(api: AxiosInstance, config_path = '', linked_components: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.config_path = config_path || '';
    this.linked_components = linked_components;
  }

  static async create(api: AxiosInstance) {
    return this.createFromPath(api, '');
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string, linked_components: Dictionary<string> = {}): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path, linked_components);
    const env_config = dependency_manager.config_path
      ? await EnvironmentConfigBuilder.buildFromPath(dependency_manager.config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});

    await dependency_manager.init(env_config);
    return dependency_manager;
  }

  /**
   * @override
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  async loadComponentConfig(initial_config: ComponentConfig) {
    const component_extends = initial_config.getExtends();
    const component_name = initial_config.getName();

    if (component_extends && component_extends.startsWith('file:')) {
      return ComponentConfigBuilder.buildFromPath(component_extends.substr('file:'.length));
    } else if (component_name in this.linked_components) {
      initial_config.setExtends(`file:${this.linked_components[component_name]}`);
      // Load locally linked component config
      console.log(`Using locally linked ${chalk.blue(component_name)} found at ${chalk.blue(this.linked_components[component_name])}`);
      return ComponentConfigBuilder.buildFromPath(this.linked_components[component_name]);
    }

    if (component_extends) {
      // Load remote component config
      const [component_name, component_tag] = component_extends.split(':');
      const [account_prefix, component_suffix] = component_name.split('/');
      const { data: component_version } = await this.api.get(`/accounts/${account_prefix}/components/${component_suffix}/versions/${component_tag}`).catch((err) => {
        err.message = `Could not download component for ${component_extends}\n${err.message}`;
        throw err;
      });

      const config = ComponentConfigBuilder.buildFromJSON(component_version.config);
      return config;
    } else {
      return ComponentConfigBuilder.buildFromJSON(initial_config);
    }
  }

  async loadComponentConfigWrapper(initial_config: ComponentConfig) {
    const component_config = await super.loadComponentConfigWrapper(initial_config);
    let component_path = component_config.getLocalPath();
    if (component_path) {
      component_path = fs.lstatSync(component_path).isFile() ? path.dirname(component_path) : component_path;
    }
    return component_config;
  }

  validateComponent(component: ComponentConfig, context: object) {
    const errors = super.validateComponent(component, context);
    const component_extends = component.getExtends();
    if (component_extends?.startsWith('file:') && errors.length) {
      const component_path = component_extends.substr('file:'.length);
      const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(component_path);
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return errors;
  }

  validateEnvironment(environment: EnvironmentConfig, enriched_environment: EnvironmentConfig) {
    const errors = super.validateEnvironment(environment, enriched_environment);
    if (this.config_path && errors.length) {
      const file_contents = fs.readFileSync(this.config_path);
      throw new ValidationErrors(this.config_path, flattenValidationErrorsWithLineNumbers(errors, file_contents.toString()));
    }
    return errors;
  }

  async interpolateEnvironment(graph: DependencyGraph, environment: EnvironmentConfig, component_map: Dictionary<ComponentConfig>) {
    // Only include in cli since it will read files off disk
    for (const [vault_name, vault] of Object.entries(environment.getVaults())) {
      vault.client_token = readIfFile(vault.client_token, this.config_path);
      vault.role_id = readIfFile(vault.role_id, this.config_path);
      vault.secret_id = readIfFile(vault.secret_id, this.config_path);
      environment.setVault(vault_name, vault);
    }

    for (const [component_name, component] of Object.entries(environment.getComponents())) {
      for (const pv of Object.values(component.getParameters())) {
        if (pv?.default) pv.default = readIfFile(pv.default, this.config_path);
      }
      environment.setComponent(component_name, component);
    }

    return super.interpolateEnvironment(graph, environment, component_map);
  }

  toExternalHost() {
    return 'localhost';
  }

  toExternalProtocol() {
    return 'http';
  }

  toInternalHost(node: DependencyNode) {
    return Refs.url_safe_ref(node.ref);
  }

  async loadComponents(graph: DependencyGraph) {
    const components_map = await super.loadComponents(graph);
    for (const component of Object.values(components_map)) {
      for (const [sk, sv] of Object.entries(component.getServices())) {
        // If debug is enabled merge in debug options ex. debug.command -> command
        const debug_options = sv.getDebugOptions();
        if (debug_options) {
          component.setService(sk, sv.merge(debug_options));
        }
      }
    }
    return components_map;
  }

  setLinkedComponents(linked_components: Dictionary<string> = {}) {
    this.linked_components = linked_components;
  }
}
