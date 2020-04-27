import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { IsInstance, IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { ServiceConfig } from '../service-config/base';
import { ServiceConfigV1 } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { Dict } from '../utils/transform';
import { validateDictionary, validateNested } from '../utils/validation';
import { DnsConfig, EnvironmentConfig, EnvironmentParameters, EnvironmentVault } from './base';

class VaultSpecV1 {
  @IsString()
  type!: string;

  @IsString()
  host!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  client_token?: string;

  @IsOptional()
  @IsString()
  role_id?: string;

  @IsOptional()
  @IsString()
  secret_id?: string;
}

class DnsConfigSpecV1 {
  @IsOptional()
  searches?: string | string[];
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  __version = '1.0.0';

  @IsOptional()
  parameters?: EnvironmentParameters;

  @Transform((services: Dictionary<Record<string, any>>) => {
    const newServices = {} as Dictionary<ServiceConfig>;
    for (const [key, value] of Object.entries(services)) {
      newServices[key] = plainToClass(ServiceConfigV1, value);
    }
    return newServices;
  }, { toClassOnly: true })
  @IsOptional()
  protected services?: Dictionary<ServiceConfig>;

  @Transform(Dict(() => VaultSpecV1), { toClassOnly: true })
  @IsOptional()
  protected vaults?: Dictionary<VaultSpecV1>;

  @Type(() => DnsConfigSpecV1)
  @IsOptional()
  @IsInstance(DnsConfigSpecV1)
  protected dns?: DnsConfigSpecV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'services', errors, undefined, options);
    errors = await validateDictionary(this, 'vaults', errors, undefined, options);
    errors = await validateNested(this, 'dns', errors, options);
    return errors;
  }

  getDnsConfig(): DnsConfig {
    return this.dns || {};
  }

  setDnsConfig(dns: DnsConfig) {
    this.dns = plainToClass(DnsConfigSpecV1, dns);
  }

  getParameters(): EnvironmentParameters {
    return this.parameters || {};
  }

  getServices(): Dictionary<ServiceConfig> {
    return this.services || {};
  }

  getVaults(): Dictionary<EnvironmentVault> {
    return this.vaults || {};
  }

  setVaults(vaults: Dictionary<EnvironmentVault>) {
    const newVaults = {} as Dictionary<VaultSpecV1>;
    for (const [key, value] of Object.entries(vaults)) {
      newVaults[key] = plainToClass(VaultSpecV1, value);
    }
    this.vaults = newVaults;
  }
}
