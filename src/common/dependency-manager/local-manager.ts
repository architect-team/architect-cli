import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import untildify from 'untildify';
import DependencyManager, { DependencyNode, EnvironmentConfig, EnvironmentConfigBuilder, ServiceConfig, ServiceNode } from '../../dependency-manager/src';
import { ComponentConfig } from '../../dependency-manager/src/component-config/base';
import { ComponentConfigBuilder } from '../../dependency-manager/src/component-config/builder';
import { ServiceConfigV1 } from '../../dependency-manager/src/service-config/v1';
import { Dictionary } from '../../dependency-manager/src/utils/dictionary';
import PortUtil from '../utils/port';

export default class LocalDependencyManager extends DependencyManager {
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
    return dependency_manager;
  }

  async init() {
    const env_config = this.config_path
      ? await EnvironmentConfigBuilder.buildFromPath(this.config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});

    await super.init(env_config);
  }

  /**
   * @override
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  async loadLocalService(service_path: string): Promise<ServiceNode> {
    // TODO: loadLocalService
    const node = new ServiceNode({
      service_config: new ServiceConfigV1(),
      node_config: new ServiceConfigV1(),
    });
    // this.graph.addNode(node);
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
      const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`).catch((err) => {
        err.message = `Could not download service for ${component_extends}\n${err.message}`;
        throw err;
      });

      const config = ComponentConfigBuilder.buildFromJSONCompat(service_digest.config);
      /*
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

  readIfFile(any_or_path: any): any {
    if (any_or_path && any_or_path.startsWith && any_or_path.startsWith('file:')) {
      const file_path = untildify(any_or_path.slice('file:'.length));
      const res = fs.readFileSync(path.resolve(path.dirname(this.config_path), file_path), 'utf-8');
      return res.trim();
    } else {
      return any_or_path;
    }
  }

  async interpolateEnvironment(environment: EnvironmentConfig) {
    const interpolated_environment = await super.interpolateEnvironment(environment);
    // Only include in cli since it will read files off disk
    for (const vault of Object.values(interpolated_environment.getVaults())) {
      vault.client_token = this.readIfFile(vault.client_token);
      vault.role_id = this.readIfFile(vault.role_id);
      vault.secret_id = this.readIfFile(vault.secret_id);
    }
    for (const component of Object.values(interpolated_environment.getComponents()) as Array<ComponentConfig>) {
      for (const pv of Object.values(component.getParameters())) {
        if (pv?.default) pv.default = this.readIfFile(pv.default);
      }
    }
    return interpolated_environment;
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

  getNodeConfig(service_config: ServiceConfig) {
    let node_config = super.getNodeConfig(service_config);
    // If debug is enabled merge in debug options ex. debug.command -> command
    const debug_options = node_config.getDebugOptions();
    if (debug_options) {
      node_config = node_config.merge(debug_options);
    }
    return node_config;
  }
}
