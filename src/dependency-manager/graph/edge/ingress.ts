import DependencyEdge from '.';
import { Dictionary } from '../../utils/dictionary';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';

  consumers_map: Dictionary<Set<string>>;

  constructor(from: string, to: string, interface_mappings: { interface_from: string, interface_to: string }[]) {
    super(from, to, interface_mappings);
    this.consumers_map = {};
  }
}
