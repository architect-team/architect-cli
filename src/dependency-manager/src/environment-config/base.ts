export interface DebugConfig {
  path: string;
}

export interface EnvironmentParameters {
  [key: string]: string | number;
}

interface ServiceDatastore {
  host?: string;
  port?: number;
  parameters: EnvironmentParameters;
}

export interface EnvironmentVault {
  type: string;
  host: string;
  description?: string;
  client_token?: string;
  role_id?: string;
  secret_id?: string;
}

export interface EnvironmentService {
  host?: string;
  port?: number;
  parameters: EnvironmentParameters;
  datastores: {
    [key: string]: ServiceDatastore;
  };
  ingress?: {
    subdomain: string;
  };
  debug?: {
    path: string;
    dockerfile?: string;
    volumes?: { [s: string]: string };
    entrypoint?: string | string[];
  };
}

export abstract class EnvironmentConfig {
  abstract __version: string;
  abstract getParameters(): EnvironmentParameters;
  abstract getVaults(): { [key: string]: EnvironmentVault };
  abstract getServices(): { [key: string]: EnvironmentService };

  getServiceDetails(key: string): EnvironmentService | undefined {
    const services = this.getServices();
    const ref = Object.keys(services).find(svc_key => key.startsWith(svc_key));
    return ref ? services[ref] : undefined;
  }

  getVolumes(key: string) {
    const services = this.getServices();
    const ref = Object.keys(services).find(svc_key => key.startsWith(svc_key));
    const debug = ref && services[ref].debug ? services[ref].debug : undefined;
    return debug ? debug.volumes : undefined;
  }
}
