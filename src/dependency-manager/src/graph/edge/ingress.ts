import DependencyEdge from '.';
import { Dictionary } from '../../utils/dictionary';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';

  consumers_map: Dictionary<Set<string>>;

  constructor(from: string, to: string, interfaces_map: Dictionary<string>) {
    super(from, to, interfaces_map);
    this.consumers_map = {};
  }
}
