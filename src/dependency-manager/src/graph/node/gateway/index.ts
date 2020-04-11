import { DependencyNode } from '..';

export default class GatewayNode extends DependencyNode {
  __type = 'gateway';

  // TODO: TJ do something better
  node_config = {};

  get env_ref(): string {
    return this.ref;
  }

  get ref(): string {
    return 'gateway';
  }
}
