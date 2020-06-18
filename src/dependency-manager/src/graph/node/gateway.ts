import { DependencyNode } from '.';

export default class GatewayNode extends DependencyNode {
  __type = 'gateway';

  ref = 'gateway';

  get interfaces(): { [key: string]: any } {
    return { _default: { port: 80 } };
  }
}
