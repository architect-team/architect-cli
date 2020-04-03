import { EnvironmentService } from '../environment-service/base';

export interface DebugConfig {
  path: string;
}

export interface EnvironmentParameters {
  [key: string]: string | number;
}

export interface EnvironmentVault {
  type: string;
  host: string;
  description?: string;
  client_token?: string;
  role_id?: string;
  secret_id?: string;
}

export abstract class EnvironmentConfig {
  abstract __version: string;
  abstract getParameters(): EnvironmentParameters;
  abstract getVaults(): { [key: string]: EnvironmentVault };
  abstract getServices(): { [key: string]: EnvironmentService };

  getServiceDetails(key: string): EnvironmentService | undefined {
    const services = this.getServices();
    const ref = Object.keys(services).find(svc_key => key.startsWith(svc_key));
    if (!ref) {
      throw new Error(`Service ${key} not found in environment config`);
    }
    return services[ref];
  }
}
