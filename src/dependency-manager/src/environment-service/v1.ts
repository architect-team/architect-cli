import { EnvironmentService } from './base';

interface InterfaceSpecV1 {
  description?: string;
  host: string;
  port: number;
}

interface DebugSpecV1 {
  path: string;
  dockerfile?: string;
  volumes?: string[];
  entrypoint?: string | string[];
}

interface IngressSpecV1 {
  subdomain: string;
}

export interface EnvironmentParametersV1 {
  [key: string]: string | number;
}

interface ServiceDatastoreV1 {
  host?: string;
  port?: number;
  parameters: EnvironmentParametersV1;
}

export class EnvironmentServiceV1 extends EnvironmentService {
  __version = '1.0.0';

  host?: string;
  port?: number;
  parameters: EnvironmentParametersV1 = {};
  datastores: { [key: string]: ServiceDatastoreV1 } = {};
  ingress?: IngressSpecV1;
  debug?: DebugSpecV1;
  interfaces: { [key: string]: InterfaceSpecV1 } = {};

  getInterfaces(): { [s: string]: InterfaceSpecV1 } {
    const port = this.port || 8080;
    return Object.keys(this.interfaces || {}).length ? this.interfaces! : { _default: { port, host: this.host! } };
  }

  getHost() {
    return this.host;
  }

  getPort() {
    return this.port;
  }

  getDatastores() {
    return this.datastores;
  }

  getParameters() {
    return this.parameters;
  }

  getDebug() {
    return this.debug;
  }

  getIngress() {
    return this.ingress;
  }
}
