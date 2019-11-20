import { DependencyNode } from './node';

declare type EDGE_TYPE = 'notification' | 'dependency';

export default class DependencyEdge {
  from: DependencyNode;
  to: DependencyNode;
  type: EDGE_TYPE;

  constructor(from: DependencyNode, to: DependencyNode, type: EDGE_TYPE = 'dependency') {
    this.from = from;
    this.to = to;
    this.type = type;
  }
}
