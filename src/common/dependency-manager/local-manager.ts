import { AxiosInstance } from 'axios';
import path from 'path';
import DependencyManager, { EnvironmentConfigBuilder, EnvironmentService, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import PortUtil from '../utils/port';
import LocalDependencyGraph from './local-graph';
import { LocalServiceNode } from './local-service-node';


export default class LocalDependencyManager extends DependencyManager {
  graph: LocalDependencyGraph;
  api: AxiosInstance;
  config_path: string;

  constructor(api: AxiosInstance, config_path?: string) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});
    super(env_config);
    this.graph = new LocalDependencyGraph(env_config.__version);
    this.api = api;
    this.config_path = config_path || '';
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path);

    const dependency_resolvers = [];
    for (const [ref, env_svc_cfg] of Object.entries(dependency_manager.environment.getServices())) {

      if (env_svc_cfg.host && env_svc_cfg.port) {
        dependency_manager.loadExternalService(env_svc_cfg, ref);
      } else {
        let svc_node: ServiceNode;

        if (env_svc_cfg.debug) {
          const svc_path = path.join(path.dirname(env_config_path), env_svc_cfg.debug.path);
          svc_node = await dependency_manager.loadLocalService(svc_path);
        } else {
          const [name, tag] = ref.split(':');
          svc_node = await dependency_manager.loadService(name, tag);
        }
        await dependency_manager.loadDatastores(svc_node);
        dependency_resolvers.push(() => dependency_manager.loadDependencies(svc_node));
      }
    }

    // We resolve these after the loop to ensure that explicitly cited service configs take precedence
    await Promise.all(dependency_resolvers.map(fn => fn()));
    dependency_manager.loadSubscriptions();
    dependency_manager.loadParameters();
    return dependency_manager;
  }

  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortUtil.getAvailablePort();
  }

  async loadExternalService(env_service_config: EnvironmentService, service_ref: string) {
    const node = new ExternalNode({
      host: env_service_config.host!,
      ports: {
        expose: env_service_config.port!,
        target: env_service_config.port!
      },
      parameters: env_service_config.parameters,
      key: service_ref
    });
    this.graph.addNode(node);
  }

  async loadLocalService(service_path: string): Promise<ServiceNode> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);

    if (this.graph.nodes_map.has(`${config.getName()}:latest`)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.graph.nodes_map.get(`${config.getName()}:latest`)! as ServiceNode;
    }

    const node = new LocalServiceNode({
      service_path: service_path,
      service_config: config,
      image: '',
      tag: 'latest',
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      parameters: await this.getParamValues(
        `${config.getName()}:latest`,
        config.getParameters(),
      ),
    });

    if (config.getDebugOptions()) {
      node.command = config.getDebugOptions()?.command;
    }

    this.graph.addNode(node);
    return node;
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: ServiceNode, recursive = true) {
    if (parent_node instanceof ExternalNode) { return; }

    const dependency_resolvers = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      let dep_node: ServiceNode;

      const env_services = this.environment.getServiceDetails(`${dep_name}:${dep_id}`);
      if (env_services && env_services.debug) {
        const svc_path = path.join(path.dirname(this.config_path), env_services.debug.path);
        dep_node = await this.loadLocalService(svc_path);
      } else {
        dep_node = await this.loadService(dep_name, dep_id);
      }

      this.graph.addNode(dep_node);
      const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
      this.graph.addEdge(edge);
      if (recursive) {
        await this.loadDatastores(dep_node);
        dependency_resolvers.push(() => this.loadDependencies(dep_node));
      }
    }

    await Promise.all(dependency_resolvers.map(fn => fn()));
  }

  /**
   * @override
   */
  async loadService(service_name: string, service_tag: string): Promise<ServiceNode> {
    const [account_name, svc_name] = service_name.split('/');
    const { data: service_digest } = await this.api.get(`/accounts/${account_name}/services/${svc_name}/versions/${service_tag}`);

    const config = ServiceConfigBuilder.buildFromJSON(service_digest.config);
    const node = new ServiceNode({
      service_config: config,
      tag: service_digest.tag,
      image: service_digest.service.url.replace(/(^\w+:|^)\/\//, ''),
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      parameters: await this.getParamValues(
        `${config.getName()}:${service_digest.tag}`,
        config.getParameters(),
      ),
    });
    this.graph.addNode(node);
    return node;
  }
}
