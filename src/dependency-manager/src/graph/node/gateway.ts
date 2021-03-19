import { DependencyNode } from '.';

export default class GatewayNode extends DependencyNode {
  __type = 'gateway';

  ref = 'gateway';

  port: number;

  constructor(port = 80) {
    super();
    this.port = port;
  }

  get interfaces(): { [key: string]: any } {
    return { _default: { port: this.port } };
  }
}
