
declare type EDGE_TYPE = 'notification' | 'dependency';

export default class DependencyEdge {
  from: string;
  to: string;
  type: EDGE_TYPE;

  constructor(from: string, to: string, type: EDGE_TYPE = 'dependency') {
    this.from = from;
    this.to = to;
    this.type = type;
  }
}
