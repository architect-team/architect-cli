import { DependencyNode } from '.';

export class GatewayNode extends DependencyNode {
  __type = 'gateway';

  host: string;
  port: number;

  static getRef(port: number): string {
    return port === 80 || port === 443 ? 'gateway' : `gateway-${port}`;
  }

  constructor(host: string, port = 80) {
    super();
    this.host = host;
    this.port = port;
  }

  get ref(): string {
    return GatewayNode.getRef(this.port);
  }

  get interfaces(): { [key: string]: any } {
    return { _default: { port: this.port } };
  }
}
