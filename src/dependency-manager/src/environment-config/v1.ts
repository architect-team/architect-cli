import { Transform } from 'class-transformer/decorators';
import { Allow, IsObject, IsOptional, ValidatorOptions } from 'class-validator';
import { ParameterValue } from '..';
import { ComponentConfig } from '../component-config/base';
import { ComponentConfigBuilder } from '../component-config/builder';
import { ComponentContextV1, ParameterDefinitionSpecV1, transformInterfaces } from '../component-config/v1';
import { InterfaceSpecV1, transformParameters } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { normalizeInterpolation } from '../utils/interpolation';
import { REPOSITORY_TAG_REGEX, validateDictionary } from '../utils/validation';
import { EnvironmentConfig, EnvironmentVault } from './base';

interface DnsConfigSpec {
  searches?: string | string[];
}

export const transformComponents = (input?: Dictionary<any>, parent?: any): Dictionary<ComponentConfig> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<ComponentConfig> = {};
  // eslint-disable-next-line prefer-const
  for (let [key, value] of Object.entries(input)) {
    if (!value) value = {};
    if (value instanceof Object) {
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: key, ...value, name: key });
    } else {
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: value.includes(':') || value.startsWith('file:') ? value : `${key}:${value}`, name: key });
    }
  }
  return output;
};

interface EnvironmentContextV1 {
  parameters: Dictionary<ParameterValue>;
  components: Dictionary<ComponentContextV1>;
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @Transform(transformParameters)
  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected parameters?: Dictionary<ParameterDefinitionSpecV1>;

  @Transform(transformComponents)
  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected components?: Dictionary<ComponentConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected vaults?: Dictionary<EnvironmentVault>;

  @IsOptional({ always: true })
  protected dns?: DnsConfigSpec;

  @Transform(transformInterfaces)
  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of components need to expose services' })
  interfaces?: Dictionary<InterfaceSpecV1>;

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

  getInterfaces() {
    return this.interfaces || {};
  }

  getContext(): EnvironmentContextV1 {
    const parameters: Dictionary<ParameterValue> = {};
    for (const [pk, pv] of Object.entries(this.getParameters())) {
      parameters[pk] = pv.default === undefined ? '' : pv.default;
    }

    const components: Dictionary<ComponentContextV1> = {};
    for (const [ck, cv] of Object.entries(this.getComponents())) {
      const normalized_ck = normalizeInterpolation(ck);
      components[normalized_ck] = cv.getContext();
      delete components[normalized_ck].services;
      delete components[normalized_ck].dependencies;
    }

    return {
      parameters,
      components,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_-]+$/);
    errors = await validateDictionary(this, 'components', errors, undefined, options, new RegExp(`^${REPOSITORY_TAG_REGEX}$`));
    return errors;
  }
}
