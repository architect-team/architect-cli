import { Transform } from 'class-transformer';
import DependencyEdge from '.';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';
  @Transform(value => (value ? value.toLowerCase() : value))
  subdomain!: string;

  constructor(from: string, to: string, subdomain: string) {
    super(from, to);
    if (subdomain) {
      this.subdomain = subdomain.toLowerCase();
    }
  }
}
