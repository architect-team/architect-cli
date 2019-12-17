import { Type } from 'class-transformer';
import { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import DependencyEdge from '../../dependency-manager/src/graph/edge';
import NotificationEdge from '../../dependency-manager/src/graph/edge/notification';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import { LocalServiceNode } from './local-service-node';

export default class LocalDependencyGraph extends DependencyGraph {
  @Type(() => DependencyNode, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: LocalServiceNode, name: 'local' },
        { value: DatastoreNode, name: 'datastore' },
        { value: ExternalNode, name: 'external' },
        { value: ServiceNode, name: 'service' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  nodes: DependencyNode[] = [];

  @Type(() => DependencyEdge, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: ServiceEdge, name: 'service' },
        { value: NotificationEdge, name: 'notification' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  edges: DependencyEdge[] = [];
}
