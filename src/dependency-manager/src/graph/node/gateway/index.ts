import { DependencyNode } from '..';

export default class GatewayNode extends DependencyNode {
  __type = 'gateway';

  get env_ref(): string {
    return this.ref;
  }

  get ref(): string {
    return 'gateway';
  }

  get interfaces(): { [key: string]: any } {
    return { _default: { port: 80 } };
  }
}
