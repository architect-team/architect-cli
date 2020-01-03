import DependencyEdge from '.';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';
  subdomain: string;

  constructor(from: string, to: string, subdomain: string) {
    super(from, to);
    this.subdomain = subdomain;
  }
}
