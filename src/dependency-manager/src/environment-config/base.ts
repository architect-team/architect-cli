import { Parameter } from '../manager';
import { ServiceConfig } from '../service-config/base';

export interface EnvironmentParameters {
  [key: string]: Parameter;
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
    const ref = Object.keys(services).find(svc_key => key.startsWith(svc_key));
    return ref ? services[ref] : undefined;
  }
}
