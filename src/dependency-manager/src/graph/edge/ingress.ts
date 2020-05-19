import DependencyEdge from '.';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';

  constructor(from: string, to: string) {
    super(from, to);
  }
}
