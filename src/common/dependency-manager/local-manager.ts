import { AxiosInstance } from 'axios';
import path from 'path';
import DependencyManager, { DependencyNode, EnvironmentConfigBuilder, ServiceConfigBuilder, ServiceNode } from '../../dependency-manager/src';
import PortUtil from '../utils/port';
import { LocalServiceNode } from './local-service-node';


export default class LocalDependencyManager extends DependencyManager {
  api: AxiosInstance;
  config_path: string;

  constructor(api: AxiosInstance, config_path?: string) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});
    super(env_config);
    this.api = api;
    this.config_path = config_path || '';
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path);

    const dependency_resolvers = [];
    for (const [ref, env_svc_cfg] of Object.entries(dependency_manager.environment.getServices())) {
      let svc_node: DependencyNode;

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

    // We resolve these after the loop to ensure that explicitly cited service configs take precedence
    await Promise.all(dependency_resolvers.map(fn => fn()));
    return dependency_manager;
  }

  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortUtil.getAvailablePort();
  }

  async loadLocalService(service_path: string): Promise<DependencyNode> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);

    if (this.graph.nodes.has(`${config.getName()}:latest`)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.graph.nodes.get(`${config.getName()}:latest`)!;
    }

    let node = new LocalServiceNode({
      service_path: service_path,
      service_config: config,
      tag: 'latest',
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      subscriptions: config.getSubscriptions(),
      parameters: await this.getParamValues(
        `${config.getName()}:latest`,
        config.getParameters(),
      ),
    });

    if (config.getDebugOptions()) {
      node.command = config.getDebugOptions()?.command;
    }

    node = this.graph.addNode(node) as LocalServiceNode;
    return node;
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: DependencyNode, recursive = true) {
    const dependency_resolvers = [];
    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      let dep_node: DependencyNode;

      const env_services = this.environment.getServiceDetails(`${dep_name}:${dep_id}`);
      if (env_services && env_services.debug) {
        const svc_path = path.join(path.dirname(this.config_path), env_services.debug.path);
        dep_node = await this.loadLocalService(svc_path);
      } else {
        dep_node = await this.loadService(dep_name, dep_id);
      }

      this.graph.addEdge(parent_node, dep_node);
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
  async loadService(service_name: string, service_tag: string): Promise<DependencyNode> {
    const { data: service } = await this.api.get(`/services/${service_name}`);
    const { data: tag } = await this.api.get(`/services/${service.name}/versions/${service_tag}`);

    const config = ServiceConfigBuilder.buildFromJSON(tag.config);
    const node = new ServiceNode({
      service_config: config,
      tag: tag.tag,
      image: service.url.replace(/(^\w+:|^)\/\//, ''),
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      subscriptions: config.getSubscriptions(),
      parameters: await this.getParamValues(
        `${config.getName()}:${tag.tag}`,
        config.getParameters(),
      ),
    });

    return this.graph.addNode(node);
  }
}
