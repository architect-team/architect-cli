import { Type } from 'class-transformer';
import { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import DependencyEdge from '../../dependency-manager/src/graph/edge';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';

export default class LocalDependencyGraph extends DependencyGraph {
  @Type(() => DependencyNode, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: DatastoreNode, name: 'datastore' },
        { value: ServiceNode, name: 'service' },
        { value: GatewayNode, name: 'gateway' },
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
        { value: IngressEdge, name: 'ingress' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  edges: DependencyEdge[] = [];
}
