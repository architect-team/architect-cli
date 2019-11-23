import { AxiosInstance } from 'axios';
import path from 'path';
import DependencyManager, { DependencyNode, EnvironmentConfigBuilder, ServiceConfig, ServiceConfigBuilder } from '../../dependency-manager/src';
import PortManager from '../port-manager';
import { LocalServiceNode } from './local-service-node';


export default class LocalDependencyManager extends DependencyManager {
  config_path: string;

  constructor(api: AxiosInstance, config_path?: string) {
    const env_config = config_path
      ? EnvironmentConfigBuilder.buildFromPath(config_path)
      : EnvironmentConfigBuilder.buildFromJSON({});
    super(api, env_config);
    this.config_path = config_path || '';
  }

  static async createFromPath(api: AxiosInstance, env_config_path: string): Promise<LocalDependencyManager> {
    const dependency_manager = new LocalDependencyManager(api, env_config_path);

    const dependency_resolvers = [];
    for (const [ref, env_svc_cfg] of Object.entries(dependency_manager.environment.getServices())) {
      let svc_node: DependencyNode;
      let svc_cfg: ServiceConfig;

      if (env_svc_cfg.debug) {
        const svc_path = path.join(path.dirname(env_config_path), env_svc_cfg.debug.path);
        [svc_node, svc_cfg] = await dependency_manager.loadLocalService(svc_path);
      } else {
        const [name, tag] = ref.split(':');
        [svc_node, svc_cfg] = await dependency_manager.loadService(name, tag);
      }

      dependency_resolvers.push(dependency_manager.loadDependencies(svc_node, svc_cfg));
      dependency_resolvers.push(dependency_manager.loadDatastores(svc_node, svc_cfg));
    }

    // We resolve these after the loop to ensure that explicitly cited service configs take precedence
    await Promise.all(dependency_resolvers);
    return dependency_manager;
  }

  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortManager.getAvailablePort();
  }

  async loadLocalService(service_path: string): Promise<[DependencyNode, ServiceConfig]> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);
    let node = new LocalServiceNode({
      service_path: service_path,
      name: config.getName(),
      tag: 'local',
      ports: {
        target: 8080,
        expose: await this.getServicePort(),
      },
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      api: config.getApiSpec(),
      subscriptions: config.getSubscriptions(),
      parameters: this.getParamValues(
        `${config.getName()}:local`,
        config.getParameters(),
      ),
    });

    if (config.getDebugOptions()) {
      node.command = config.getDebugOptions()?.command;
    }

    node = this.graph.addNode(node) as LocalServiceNode;
    return [node, config];
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: DependencyNode, parent_config: ServiceConfig, recursive = true) {
    const dependency_resolvers = [];
    for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
      let dep_node: DependencyNode;
      let dep_config: ServiceConfig;

      const env_services = this.environment.getServiceDetails(`${dep_name}:${dep_id}`);
      if (env_services && env_services.debug) {
        const svc_path = path.join(path.dirname(this.config_path), env_services.debug.path);
        [dep_node, dep_config] = await this.loadLocalService(svc_path);
      } else {
        [dep_node, dep_config] = await this.loadService(dep_name, dep_id);
      }

      dep_node = this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
      if (recursive) {
        dependency_resolvers.push(this.loadDependencies(dep_node, dep_config));
        dependency_resolvers.push(this.loadDatastores(dep_node, dep_config));
      }
    }

    await Promise.all(dependency_resolvers);
  }
}
