export interface DebugConfig {
  path: string;
}

interface EnvironmentParameters {
  [key: string]: string | number;
}

interface ServiceDatastore {
  host?: string;
  port?: string | number;
  parameters: EnvironmentParameters;
}

export interface EnvironmentService {
  host?: string;
  port?: string | number;
  parameters: EnvironmentParameters;
  datastores: {
    [key: string]: ServiceDatastore;
  };
  debug?: {
    path: string;
  };
}

export abstract class EnvironmentConfig {
  abstract getServices(): { [key: string]: EnvironmentService };

  getServiceDetails(key: string): EnvironmentService | undefined {
    const services = this.getServices();
    const ref = Object.keys(services).find(svc_key => key.startsWith(svc_key));
    return ref ? services[ref] : undefined;
  }
}
