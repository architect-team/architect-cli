import { AxiosInstance } from 'axios';
import chalk from 'chalk';
import path from 'path';
import DependencyManager, { EnvironmentConfigBuilder, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
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
    for (const ref of Object.keys(dependency_manager._environment.getServices())) {
      const [name, tag] = ref.split(':');
      const svc_node = await dependency_manager.loadService(name, tag);
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

    const node = new LocalServiceNode({
      service_path: service_path.endsWith('.json') ? path.dirname(service_path) : service_path,
      service_config: service_config,
      node_config: this.getNodeConfig(service_config),
      image: service_config.getImage(),
      tag: 'latest',
    });

    this.graph.addNode(node);
    return node;
  }

  /**
   * @override
   */
  async loadService(service_name: string, service_tag: string, recursive = true): Promise<ServiceNode | ExternalNode> {
    const ref = `${service_name}:${service_tag}`;
    const existing_node = this.graph.nodes_map.get(ref);
    if (existing_node) {
      return existing_node as ServiceNode | ExternalNode;
    }

    const env_service = this._environment.getServiceDetails(ref);
    if (env_service?.getInterfaces() && Object.values(env_service?.getInterfaces()).every((i) => (i.host))) {
      return this.loadExternalService(env_service, ref);
    }

    const debug_path = env_service?.getDebugOptions()?.path;
    let service_node;
    if (debug_path) {
      const svc_path = path.join(path.dirname(this.config_path), debug_path);
      service_node = await this.loadLocalService(svc_path);
    } else if (this.linked_services.hasOwnProperty(service_name)) {
      console.log(`Using locally linked ${chalk.blue(service_name)} found at ${chalk.blue(this.linked_services[service_name])}`);
      service_node = await this.loadLocalService(this.linked_services[service_name]);
    } else {
      const [account_name, svc_name] = service_name.split('/');
      const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`);

      const service_config = ServiceConfigBuilder.buildFromJSON(service_digest.config);
      service_node = new ServiceNode({
        service_config: service_config,
        node_config: this.getNodeConfig(service_config),
        tag: service_digest.tag,
        image: service_digest.service.url.replace(/(^\w+:|^)\/\//, ''),
        digest: service_digest.digest,
      });
    }

    this.graph.addNode(service_node);
    await this.loadDatastores(service_node);
    if (recursive) {
      await this.loadDependencies(service_node, recursive);
    }
    return service_node;
  }

  protected async loadParameters() {
    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        // Only include in cli since it will read files off disk
        node.parameters[key] = readIfFile(value);
      }
    }
    await super.loadParameters();
  }

  /**
  * @override
  */
  async loadServiceConfig(node_ref: string) {
    const debug_path = this._environment.getServices()[node_ref]?.getDebugOptions()?.path;
    if (debug_path) {
      return ServiceConfigBuilder.buildFromPath(path.join(path.dirname(this.config_path), debug_path));
    } else {
      const [account_name, service_name, service_tag] = node_ref.split(/\/|:/);
      const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${service_name}/versions/${service_tag}`);
      return ServiceConfigBuilder.buildFromJSON(service_digest.config);
    }
  }
}
