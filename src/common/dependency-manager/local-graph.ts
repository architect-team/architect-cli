import { plainToClass, Transform } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
import { DatastoreNode, DependencyNode, ServiceNode } from '../../dependency-manager/src';
import DependencyGraph from '../../dependency-manager/src/graph';
import DependencyEdge from '../../dependency-manager/src/graph/edge';
import IngressEdge from '../../dependency-manager/src/graph/edge/ingress';
import NotificationEdge from '../../dependency-manager/src/graph/edge/notification';
import ServiceEdge from '../../dependency-manager/src/graph/edge/service';
import { ExternalNode } from '../../dependency-manager/src/graph/node/external';
import GatewayNode from '../../dependency-manager/src/graph/node/gateway';
import { LocalServiceNode } from './local-service-node';

const NodeTypes = {
  local: LocalServiceNode,
  datastore: DatastoreNode,
  external: ExternalNode,
  service: ServiceNode,
  gateway: GatewayNode,
} as { [key: string]: ClassType<DependencyNode> };

const EdgeTypes = {
  service: ServiceEdge,
  notification: NotificationEdge,
  ingress: IngressEdge,
} as { [key: string]: ClassType<DependencyEdge> };

const TransformNodes = (group: string) => Transform(nodes => {
  const res = [];
  for (const value of (nodes || [])) {
    res.push(plainToClass(NodeTypes[value.__type], value, { groups: [group] }));
  }
  return res;
}, { toClassOnly: true, groups: [group] });

const TransformEdges = (group: string) => Transform(edges => {
  const res = [];
  for (const value of (edges || [])) {
    res.push(plainToClass(EdgeTypes[value.__type], value, { groups: [group] }));
  }
  return res;
}, { toClassOnly: true, groups: [group] });

export default class LocalDependencyGraph extends DependencyGraph {
  @TransformNodes('allow-shorthand')
  @TransformNodes('transform-shorthand')
  nodes: DependencyNode[] = [];

  @TransformEdges('allow-shorthand')
  @TransformNodes('transform-shorthand')
  edges: DependencyEdge[] = [];
}
