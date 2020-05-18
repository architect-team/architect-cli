import DependencyEdge from '.';
import { ServiceInterfaceSpec } from '../../service-config/base';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';
  to_interfaces: { [s: string]: ServiceInterfaceSpec };

  constructor(from: string, to: string, to_interfaces: { [s: string]: ServiceInterfaceSpec }) {
    super(from, to);
    this.to_interfaces = to_interfaces;
  }
}
