import DependencyNode from '../node';

export default class DependencyEdge {
  from: DependencyNode;
  to: DependencyNode;

  constructor(from: DependencyNode, to: DependencyNode) {
    this.from = from;
    this.to = to;
  }
}
