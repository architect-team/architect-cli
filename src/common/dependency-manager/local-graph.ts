import { Type } from 'class-transformer';
import { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import { LocalServiceNode } from './local-service-node';

export default class LocalDependencyGraph extends DependencyGraph {
  @Type(() => DependencyNode, {
    discriminator: {
      property: "__type",
      subTypes: [
        { value: LocalServiceNode, name: "local" },
        { value: DatastoreNode, name: "datastore" },
        { value: ExternalNode, name: "external" },
        { value: ServiceNode, name: "service" },
      ],
    },
  })
  nodes: DependencyNode[] = [];
}
