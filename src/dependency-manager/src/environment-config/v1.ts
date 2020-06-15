import { serialize } from 'class-transformer';
import { Transform } from 'class-transformer/decorators';
import { Allow, IsOptional, ValidatorOptions } from 'class-validator';
import { ParameterValue } from '..';
import { ComponentConfig } from '../component-config/base';
import { ComponentConfigBuilder } from '../component-config/builder';
import { ParameterDefinitionSpecV1 } from '../component-config/v1';
import { transformParameters } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { interpolateString } from '../utils/interpolation';
import { validateDictionary } from '../utils/validation';
import { EnvironmentConfig, EnvironmentVault } from './base';

interface DnsConfigSpec {
  searches?: string | string[];
}

export const transformComponents = (input?: Dictionary<any>, parent?: any): Dictionary<ComponentConfig> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ComponentConfig> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object) {
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: key, ...value, name: key });
    } else {
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: value.includes(':') ? value : `${key}:${value}`, name: key });
    }
  }
  return output;
};

interface EnvironmentContextV1 {
  parameters: Dictionary<ParameterValue>;
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  protected parameters?: Dictionary<ParameterDefinitionSpecV1>;

  @Transform(transformComponents)
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

  getComponents() {
    return this.components || {};
  }

  getVaults() {
    return this.vaults || {};
  }

  getContext(): EnvironmentContextV1 {
    const parameters: Dictionary<ParameterValue> = {};
    for (const [pk, pv] of Object.entries(this.getParameters())) {
      parameters[pk] = pv.default === undefined ? '' : pv.default;
    }

    return {
      parameters,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'components', errors, undefined, options);
    if ('operator' in (options.groups || [])) {
      interpolateString(serialize(this), this.getContext(), ['vaults.']);
    }
    return errors;
  }
}
