import { Transform } from 'class-transformer/decorators';
import { ServiceConfig } from '../service-config/base';
import { transformServices } from '../service-config/v1';
import { EnvironmentConfig, EnvironmentParameters, EnvironmentVault } from './base';

interface VaultMap {
  [vault_name: string]: {
    type: string;
    host: string;
    description?: string;
    client_token?: string;
    role_id?: string;
    secret_id?: string;
  };
}

interface DnsConfigSpec {
  searches?: string | string[];
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  __version = '1.0.0';
  protected parameters: EnvironmentParameters = {};
  @Transform(value => (transformServices(value)))
  protected services: { [service_ref: string]: ServiceConfig } = {};
  protected vaults: VaultMap = {};
  protected dns?: DnsConfigSpec;

  getDnsConfig(): DnsConfigSpec {
    return this.dns || {};
  }

  getParameters(): EnvironmentParameters {
    return this.parameters;
  }

  getServices(): { [key: string]: ServiceConfig } {
    return this.services;
  }

  getVaults(): { [key: string]: EnvironmentVault } {
    return this.vaults;
  }
}
