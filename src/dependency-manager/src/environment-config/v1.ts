import { plainToClass } from 'class-transformer';
import { Transform } from 'class-transformer/decorators';
import { Allow, IsOptional, ValidatorOptions } from 'class-validator';
import { ComponentConfig } from '../component-config/base';
import { ComponentConfigV1 } from '../component-config/v1';
import { ParameterValue, ServiceConfig } from '../service-config/base';
import { transformParameters, transformServices } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary } from '../utils/validation';
import { EnvironmentConfig, EnvironmentVault } from './base';

interface DnsConfigSpec {
  searches?: string | string[];
}

export const transformComponents = (input?: Dictionary<any>): Dictionary<ComponentConfig> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ComponentConfig> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = plainToClass(ComponentConfigV1, value);
  }
  return output;
};

export class EnvironmentConfigV1 extends EnvironmentConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  protected parameters?: Dictionary<ParameterValue>;

  @Transform(value => (transformServices(value)))
  @IsOptional({ always: true })
  protected services?: Dictionary<ServiceConfig>;

  @Transform(value => (transformComponents(value)))
  @IsOptional({ always: true })
  protected components?: Dictionary<ComponentConfig>;

  @IsOptional({ always: true })
  protected vaults?: Dictionary<EnvironmentVault>;

  @IsOptional({ always: true })
  protected dns?: DnsConfigSpec;

  getDnsConfig(): DnsConfigSpec {
    return this.dns || {};
  }

  getParameters() {
    return this.parameters || {};
  }

  getServices() {
    return this.services || {};
  }

  getComponents() {
    return this.components || {};
  }

  getVaults() {
    return this.vaults || {};
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, options);
    errors = await validateDictionary(this, 'components', errors, undefined, options);
    return errors;
  }
}
