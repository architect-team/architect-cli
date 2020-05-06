import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import DependencyManager, { DependencyNode, EnvironmentConfigBuilder, ServiceConfig, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import { readIfFile } from '../utils/file';
import PortUtil from '../utils/port';
import LocalDependencyGraph from './local-graph';
import { LocalServiceNode } from './local-service-node';

export default class LocalDependencyManager extends DependencyManager {
  graph!: LocalDependencyGraph;
  api: AxiosInstance;
  config_path: string;
  linked_services: LinkedServicesMap;

  protected constructor(api: AxiosInstance, config_path = '', linked_services: LinkedServicesMap = {}, debug = false) {
    super();
    this.api = api;
    this.config_path = config_path || '';
    this.linked_services = linked_services;
    this.debug = debug;
  }

  static async create(api: AxiosInstance) {
    return this.createFromPath(api, '');
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string, linked_services: LinkedServicesMap = {}, debug = false): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path, linked_services, debug);
    await dependency_manager.init();
    for (const config of Object.values(dependency_manager._environment.getServices())) {
      const svc_node = await dependency_manager.loadServiceFromConfig(config);
      if (svc_node instanceof ServiceNode) {
        const external_interfaces = Object.values(svc_node.node_config.getInterfaces()).filter(node_interface => node_interface.subdomain);
        if (external_interfaces.length === 1 && external_interfaces[0].subdomain) {
          const gateway = new GatewayNode();
          dependency_manager.graph.addNode(gateway);
          dependency_manager.graph.addEdge(new IngressEdge(gateway.ref, svc_node.ref, external_interfaces[0].subdomain));
        } else if (external_interfaces.length > 1) {
          throw new Error(`Error in service definition for ${svc_node.ref}. Only one ingress per service is supported locally.`)
        }
      }
    }
    dependency_manager.loadSubscriptions();
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

  async loadLocalService(service_path: string): Promise<ServiceNode> {
    const service_config = await ServiceConfigBuilder.buildFromPath(service_path);
    const node = await this.loadServiceNode(service_config);
    this.graph.addNode(node);
    return node;
  }

  async loadServiceConfig(initial_config: ServiceConfig) {
    let debug_path = initial_config.getDebugOptions()?.getPath();
    const service_name = initial_config.getName();

    if (debug_path) {
      // Load local service config
      if (this.config_path) {
        debug_path = path.resolve(path.dirname(this.config_path), debug_path);
      }
      return ServiceConfigBuilder.buildFromPath(debug_path);
    } else if (this.linked_services.hasOwnProperty(service_name)) {
      // Load locally linked service config
      console.log(`Using locally linked ${chalk.blue(service_name)} found at ${chalk.blue(this.linked_services[service_name])}`);
      return ServiceConfigBuilder.buildFromPath(this.linked_services[service_name]);
    }

    const service_extends = initial_config.getExtends();
    if (service_extends) {
      // Load remote service config
      const [service_name, service_tag] = service_extends.split(':');
      const [account_name, svc_name] = service_name.split('/');
      const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`);

      const config = ServiceConfigBuilder.buildFromJSON(service_digest.config);
      if (!config.getImage()) {
        config.setImage(service_digest.service.url.replace(/(^\w+:|^)\/\//, ''));
        config.setDigest(service_digest.digest);
      }
      return config;
    } else {
      return initial_config;
    }
  }

  /**
   * @override
   */
  async loadServiceNode(initial_config: ServiceConfig) {
    let node = await super.loadServiceNode(initial_config);

    // TODO: Kill LocalServiceNode
    const debug_path = node.service_config.getDebugOptions()?.getPath();
    if (debug_path) {
      const lstat = fs.lstatSync(debug_path);
      node = new LocalServiceNode({
        service_path: lstat.isFile() ? path.dirname(debug_path) : debug_path,
        ...node,
      });
    }
    return node;
  }

  async loadParameters() {
    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        // Only include in cli since it will read files off disk
        node.parameters[key] = readIfFile(value);
      }
    }
    await super.loadParameters();
  }

  toExternalHost(node: DependencyNode) {
    if (node instanceof ServiceNode) {
      const external_interfaces = Object.values(node.node_config.getInterfaces()).filter(node_interface => !!node_interface.subdomain);
      return external_interfaces.length ? `${external_interfaces[0].subdomain}.localhost` : '';
    } else {
      return '';
    }
  }

  toInternalHost(node: DependencyNode) {
    return node.normalized_ref;
  }
}
