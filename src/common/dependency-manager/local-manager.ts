import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import DependencyManager, { DependencyNode, EnvironmentConfigBuilder, ServiceConfig, ServiceNode } from '../../dependency-manager/src';
import { ComponentConfig } from '../../dependency-manager/src/component-config/base';
import { ComponentConfigBuilder } from '../../dependency-manager/src/component-config/builder';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import { ParameterDefinitionSpecV1 } from '../../dependency-manager/src/v1-spec/parameters';
import { readIfFile } from '../utils/file';
import PortUtil from '../utils/port';
import LocalDependencyGraph from './local-graph';

export default class LocalDependencyManager extends DependencyManager {
  graph!: LocalDependencyGraph;
  api: AxiosInstance;
  config_path: string;
  linked_services: Dictionary<string>;

  protected constructor(api: AxiosInstance, config_path = '', linked_services: Dictionary<string> = {}) {
    super();
    this.api = api;
    this.config_path = config_path || '';
    this.linked_services = linked_services;
  }

  static async create(api: AxiosInstance) {
    return this.createFromPath(api, '');
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string, linked_services: Dictionary<string> = {}): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path, linked_services);
    await dependency_manager.init();
    await dependency_manager.loadComponents();
    await dependency_manager.loadParameters();
    return dependency_manager;
  }

  async init() {
    const env_config = this.config_path
      ? await EnvironmentConfigBuilder.buildFromPath(this.config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});

    await super.init(env_config);

    // Only include in cli since it will read files off disk
    for (const vault of Object.values(env_config.getVaults())) {
      vault.client_token = readIfFile(vault.client_token);
      vault.role_id = readIfFile(vault.role_id);
      vault.secret_id = readIfFile(vault.secret_id);
    }
    this.graph = new LocalDependencyGraph(env_config.__version);
  }

  /**
   * @override
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  // TODO
  async loadLocalService(service_path: string): Promise<ServiceNode> {
    const component_config = await ComponentConfigBuilder.buildFromPath(service_path);
    const service_config = component_config.getServices()[0];
    const node = await this.loadServiceNode(service_config, service_config);
    this.graph.addNode(node);
    return node;
  }

  async loadComponentConfig(initial_config: ComponentConfig) {
    const component_extends = initial_config.getExtends();
    const service_name = initial_config.getName();

    if (component_extends && component_extends.startsWith('file:')) {
      return ComponentConfigBuilder.buildFromPath(component_extends.substr('file:'.length));
    } else if (this.linked_services.hasOwnProperty(service_name)) {
      // Load locally linked service config
      console.log(`Using locally linked ${chalk.blue(service_name)} found at ${chalk.blue(this.linked_services[service_name])}`);
      return ComponentConfigBuilder.buildFromPath(this.linked_services[service_name]);
    }

    if (component_extends) {
      // Load remote service config
      const [service_name, service_tag] = component_extends.split(':');
      const [account_name, svc_name] = service_name.split('/');
      const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`);

      const config = ComponentConfigBuilder.buildFromJSON(service_digest.config);
      /* TODO
      if (!config.getImage()) {
        config.setImage(service_digest.service.url.replace(/(^\w+:|^)\/\//, ''));
        config.setDigest(service_digest.digest);
      }
      */
      return config;
    } else {
      return ComponentConfigBuilder.buildFromJSON(initial_config);
    }
  }

  async loadParameters() {
    /*
    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        // Only include in cli since it will read files off disk
        node.parameters[key] = readIfFile(value);
      }
    }
    */
    await super.loadParameters();
  }

  toExternalHost(node: DependencyNode, interface_key: string) {
    if (node instanceof ServiceNode) {
      const external_interface = node.node_config.getInterfaces()[interface_key];
      if (!external_interface) {
        return '';
      }
      return external_interface?.subdomain ? `${external_interface.subdomain}.localhost` : '';
    } else {
      return '';
    }
  }

  toExternalProtocol(node: DependencyNode, interface_key: string) {
    if (node instanceof ServiceNode) {
      const host = this.toExternalHost(node, interface_key);
      if (host) {
        return 'http';
      }
    }
    return '';
  }

  toInternalHost(node: DependencyNode) {
    return node.normalized_ref;
  }

  getNodeConfig(service_config: ServiceConfig, additional_parameters: Dictionary<ParameterDefinitionSpecV1>) {
    let node_config = super.getNodeConfig(service_config, additional_parameters);
    // If debug is enabled merge in debug options ex. debug.command -> command
    const debug_options = node_config.getDebugOptions();
    if (debug_options) {
      node_config = node_config.merge(debug_options);
    }
    return node_config;
  }
}
