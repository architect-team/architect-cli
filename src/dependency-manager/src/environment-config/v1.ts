import { Transform } from 'class-transformer/decorators';
import { Allow, IsOptional, ValidatorOptions } from 'class-validator';
import { ParameterValue, ServiceConfig } from '../service-config/base';
import { transformParameters, transformServices } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary } from '../utils/validation';
import { EnvironmentConfig, EnvironmentVault } from './base';

interface DnsConfigSpec {
  searches?: string | string[];
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  protected parameters?: Dictionary<ParameterValue>;

  @Transform(value => (transformServices(value)))
  @IsOptional({ always: true })
  protected services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  protected vaults?: Dictionary<EnvironmentVault>;

  @IsOptional({ always: true })
  protected dns?: DnsConfigSpec;

  getDnsConfig(): DnsConfigSpec {
    return this.dns || {};
  }

  getParameters(): Dictionary<ParameterValue> {
    return this.parameters || {};
  }

  getServices(): { [key: string]: ServiceConfig } {
    return this.services || {};
  }

  getVaults(): { [key: string]: EnvironmentVault } {
    return this.vaults || {};
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, options);
    return errors;
  }
}
