import path from 'path';

import DependencyManager, { DependencyNode, ServiceConfig, ServiceConfigV1, ServiceConfigBuilder } from '../../dependency-manager/src';
import PortManager from '../port-manager';
import { LocalServiceNode } from './local-service-node';

export default class LocalDependencyManager extends DependencyManager {
  /**
   * @override
   */
  protected async getServicePort(): Promise<number> {
    return PortManager.getAvailablePort();
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
        dep_config = ServiceConfigBuilder.buildFromPath(dep_path);
        dep_node = new LocalServiceNode({
          service_path: dep_path,
          name: dep_name,
          tag: 'local',
          ports: {
            target: 8080,
            expose: await this.getServicePort(),
          },
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          api: dep_config.getApiSpec(),
          subscriptions: dep_config.subscriptions,
          parameters: this.getParamValues(
            `${dep_config.getName()}:${tag.tag}`,
            dep_config.getParameters(),
          ),
        });
        if (dep_config.debug) {
          (dep_node as LocalServiceNode).command = dep_config.debug;
        }
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
