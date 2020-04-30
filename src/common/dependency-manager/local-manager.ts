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

declare type LinkedServicesMap = { [serviceName: string]: string };

export default class LocalDependencyManager extends DependencyManager {
  graph: LocalDependencyGraph;
  api: AxiosInstance;
  config_path: string;
  linked_services: LinkedServicesMap;

  constructor(api: AxiosInstance, config_path = '', linked_services: LinkedServicesMap = {}, debug = false) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});

    // Only include in cli since it will read files off disk
    for (const vault of Object.values(env_config.getVaults())) {
      vault.client_token = readIfFile(vault.client_token);
      vault.role_id = readIfFile(vault.role_id);
      vault.secret_id = readIfFile(vault.secret_id);
    }

    super(env_config);
    this.graph = new LocalDependencyGraph(env_config.__version);
    this.api = api;
    this.config_path = config_path || '';
    this.linked_services = linked_services;
    this.debug = debug;
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string, linked_services: LinkedServicesMap = {}, debug = false): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path, linked_services, debug);
    for (const config of Object.values(dependency_manager._environment.getServices())) {
      const svc_node = await dependency_manager.loadServiceFromConfig(config);
      if (svc_node instanceof ServiceNode) {
        const env_ingress = svc_node.node_config.getIngress();
        if (env_ingress) {
          const gateway = new GatewayNode();
          dependency_manager.graph.addNode(gateway);
          dependency_manager.graph.addEdge(new IngressEdge(gateway.ref, svc_node.ref, env_ingress.subdomain));
        }
      }
    }
    dependency_manager.loadSubscriptions();
    await dependency_manager.loadParameters();
    return dependency_manager;
  }

  /**
   * @override
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return PortUtil.getAvailablePort(starting_port);
  }

  async loadLocalService(service_path: string): Promise<ServiceNode> {
    const service_config = ServiceConfigBuilder.buildFromPath(service_path);
    const node = await this.loadServiceNode(service_config);
    this.graph.addNode(node);
    return node;
  }

  async loadServiceConfig(initial_config: ServiceConfig) {
    const debug_path = initial_config.getDebugOptions()?.path;
    const service_name = initial_config.getName();

    if (debug_path) {
      // Load local service config
      const service_path = path.join(path.dirname(this.config_path), debug_path);
      return ServiceConfigBuilder.buildFromPath(service_path);
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
      return ServiceConfigBuilder.buildFromJSON(service_digest.config);
    }
    return initial_config;
  }

  /**
   * @override
   */
  async loadServiceNode(initial_config: ServiceConfig) {
    let node = await super.loadServiceNode(initial_config);

    // TODO: Kill LocalServiceNode
    let debug_path = node.node_config.getDebugOptions()?.path;
    if (debug_path) {
      debug_path = path.resolve(path.dirname(this.config_path), debug_path);

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
      const ingress = node.node_config.getIngress();
      return ingress ? `${ingress.subdomain}.localhost` : '';
    } else {
      return '';
    }
  }

  toInternalHost(node: DependencyNode) {
    return node.normalized_ref;
  }
}
