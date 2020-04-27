import { ParameterValue } from '../manager';
import { ServiceConfig } from '../service-config/base';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

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

export abstract class EnvironmentConfig extends BaseSpec {
  abstract __version: string;
  abstract getParameters(): EnvironmentParameters;

  abstract getVaults(): Dictionary<EnvironmentVault>;
  abstract setVaults(vaults: Dictionary<EnvironmentVault>): void;

  abstract getServices(): { [key: string]: ServiceConfig };

  abstract getDnsConfig(): DnsConfig;
  abstract setDnsConfig(dns: DnsConfig): void;

  getServiceDetails(key: string): ServiceConfig | undefined {
    const services = this.getServices();
    return services[key] || services[key.split(':')[0]];
  }
}
