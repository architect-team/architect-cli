import DependencyEdge from '.';
import { ServiceInterfaceSpec } from '../../service-config/base';

export default class IngressEdge extends DependencyEdge {
  __type = 'ingress';
  interfaces: { [s: string]: ServiceInterfaceSpec };

  constructor(from: string, to: string, interfaces: { [s: string]: ServiceInterfaceSpec }) {
    super(from, to);
    this.interfaces = interfaces;
  }
}
