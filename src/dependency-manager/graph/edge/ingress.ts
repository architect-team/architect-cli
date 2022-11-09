import { DependencyEdge } from '.';
import { Dictionary } from '../../utils/dictionary';

export class IngressEdge extends DependencyEdge {
  __type = 'ingress';

  // TODO:TJ is this the correct place
  consumers_map: Dictionary<Set<string>>;

  constructor(from: string, to: string, interface_to: string) {
    super(from, to, interface_to);
    this.consumers_map = {};
  }
}
