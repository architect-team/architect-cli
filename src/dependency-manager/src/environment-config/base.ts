import { ParameterValue, ServiceConfig } from '../service-config/base';

export interface EnvironmentParameters {
  [key: string]: ParameterValue;
}

export interface EnvironmentVault {
  type: string;
  host: string;
  description?: string;
  client_token?: string;
  role_id?: string;
  secret_id?: string;
}

export interface DnsConfig {
  searches?: string | string[];
}

export abstract class EnvironmentConfig {
  abstract __version: string;
  abstract getParameters(): EnvironmentParameters;
  abstract getVaults(): { [key: string]: EnvironmentVault };
  abstract getServices(): { [key: string]: ServiceConfig };
  abstract getDnsConfig(): DnsConfig;

  getServiceDetails(key: string): ServiceConfig | undefined {
    const services = this.getServices();

    // Remove parent ref if it exists
    const [parent, service] = key.split('.');
    key = service ? service : parent;

    return services[key] || services[key.split(':')[0]];
  }
}
