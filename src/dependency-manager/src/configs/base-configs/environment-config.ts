import { BaseSpec } from '../base-spec';
import { BaseParameterConfig, BaseServiceConfig } from './service-config';

export interface BaseVaultConfig {
  type: string;
  host: string;
  description?: string;
  client_token?: string;
  role_id?: string;
  secret_id?: string;
}

export interface BaseDnsConfig {
  searches?: string | string[];
}

export abstract class BaseEnvironmentConfig extends BaseSpec {
  abstract copy(): BaseEnvironmentConfig;

  abstract getServices(): Array<BaseServiceConfig>;
  abstract setServices(services: Array<BaseServiceConfig>): void;

  abstract getVaults(): Map<string, BaseVaultConfig>;
  abstract setVaults(vaults: Map<string, BaseVaultConfig>): void;

  abstract getDnsConfig(): BaseDnsConfig;
  abstract setDnsConfig(dns: BaseDnsConfig): void;

  abstract getParameters(): Map<string, BaseParameterConfig>;
  abstract setParameters(parameters: Map<string, BaseParameterConfig>): void;

  public addService(service: BaseServiceConfig) {
    const existing = this.getServices();
    const exists_at_index = existing.findIndex(svc => svc.getName() === service.getName());
    if (exists_at_index >= 0) {
      existing.splice(exists_at_index, 1);
    }
    existing.push(service);
    this.setServices(existing);
  }

  public merge(config: BaseEnvironmentConfig){
    this.setServices(config.getServices());
    this.setVaults(config.getVaults());
    this.setDnsConfig(config.getDnsConfig());

    // TODO: populate other getters/setters
  }

  public static copy<T extends BaseEnvironmentConfig>(this: new () => T, config: BaseEnvironmentConfig): T {
    const copy = new this();
    copy.merge(config);
    return copy;
  }
}
