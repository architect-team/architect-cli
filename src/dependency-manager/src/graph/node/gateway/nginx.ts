import GatewayNode from '.';

export default class NginxNode extends GatewayNode {
  __type = 'nginx';

  get env_ref(): string {
    return this.ref
  }

  get ref(): string {
    return 'nginx.controller'
  }
}
