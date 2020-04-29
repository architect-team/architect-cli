import { plainToClass } from 'class-transformer';
import { Transform } from 'class-transformer/decorators';
import { ServiceConfig } from '../service-config/base';
import { ServiceConfigV1 } from '../service-config/v1';
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

function transformServices(input: any) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    const [name, ref] = key.split(':');
    let config;
    if (value instanceof Object) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      if (ref && !value.ref) {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        value.ref = ref;
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      config = { private: !value.ref, ...value, name };
    } else {
      config = { ref: value, name };
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    output[key] = plainToClass(ServiceConfigV1, config);
  }
  return output;
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
