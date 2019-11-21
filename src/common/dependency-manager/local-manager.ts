import path from 'path';

import DependencyManager, { DependencyNode, ServiceConfig, ServiceConfigBuilder } from '../../dependency-manager/src';
import PortManager from '../port-manager';
import { LocalServiceNode } from './local-service-node';

export default class LocalDependencyManager extends DependencyManager {
  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortManager.getAvailablePort();
  }

  async loadLocalService(service_path: string): Promise<[DependencyNode, ServiceConfig]> {
    const config = ServiceConfigBuilder.buildFromPath(service_path);
    const node = new LocalServiceNode({
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

    this.graph.addNode(node);
    return [node, config];
  }

  /**
   * @override
   */
  async loadDependencies(parent_node: DependencyNode, parent_config: ServiceConfig) {
    for (const [dep_name, dep_id] of Object.entries(parent_config.getDependencies())) {
      let dep_node: DependencyNode;
      let dep_config: ServiceConfig;

      if (dep_id.startsWith('file:')) {
        const local_parent = parent_node as LocalServiceNode;
        const dep_path = path.join(local_parent.service_path, dep_id.slice('file:'.length));
        [dep_node, dep_config] = await this.loadLocalService(dep_path);
      } else {
        [dep_node, dep_config] = await this.loadService(dep_name, dep_id);
      }

      dep_node = this.graph.addNode(dep_node);
      this.graph.addEdge(parent_node, dep_node);
      await this.loadDependencies(dep_node, dep_config);
      await this.loadDatastores(dep_node, dep_config);
    }
  }
}
