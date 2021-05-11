import { DependencyNode } from '.';

export default class GatewayNode extends DependencyNode {
  __type = 'gateway';

  ref = 'gateway';

  host: string;
  port: number;

  constructor(host: string, port = 80) {
    super();
    this.host = host;
    this.port = port;
  }

  get interfaces(): { [key: string]: any } {
    return { _default: { port: this.port } };
  }
}
