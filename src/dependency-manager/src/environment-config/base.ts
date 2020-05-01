import { ParameterValue, ServiceConfig } from '../service-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

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

export abstract class EnvironmentConfig extends BaseSpec {
  abstract __version: string;
  abstract getParameters(): Dictionary<ParameterValue>;
  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract getServices(): Dictionary<ServiceConfig>;
  abstract getDnsConfig(): DnsConfig;

  getServiceDetails(key: string): ServiceConfig | undefined {
    const services = this.getServices();

    // Remove parent ref if it exists
    const [parent, service] = key.split('.');
    key = service ? service : parent;

    return services[key] || services[key.split(':')[0]];
  }
}
