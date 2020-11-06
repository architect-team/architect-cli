import { Allow, IsObject, IsOptional, ValidatorOptions } from 'class-validator';
import { Dictionary } from '../../utils/dictionary';
import { normalizeInterpolation } from '../../utils/interpolation';
import { ComponentVersionSlugUtils, Slugs } from '../../utils/slugs';
import { validateDictionary } from '../../utils/validation';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { transformParameters } from '../common/parameter-transformer';
import { ParameterValueSpecV1 } from '../common/parameter-v1';
import { ComponentConfig } from '../component/component-config';
import { transformComponentInterfaces, transformComponents } from '../component/component-transformer';
import { ComponentContextV1 } from '../component/component-v1';
import { EnvironmentConfig, EnvironmentVault } from './environment-config';

interface DnsConfigSpec {
  searches?: string | string[];
}

interface EnvironmentContextV1 {
  interfaces: Dictionary<InterfaceSpecV1>;
  parameters: Dictionary<ParameterValueSpecV1>;
  components: Dictionary<ComponentContextV1>;
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  @Allow({ always: true })
  __version?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected parameters?: Dictionary<ParameterValueSpecV1>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected components?: Dictionary<ComponentConfig | string>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  protected vaults?: Dictionary<EnvironmentVault>;

  @IsOptional({ always: true })
  protected dns?: DnsConfigSpec;

  @IsOptional({ groups: ['operator', 'debug'] })
  protected interfaces?: Dictionary<InterfaceSpecV1 | string>;

  getDnsConfig(): DnsConfigSpec {
    return this.dns || {};
  }

  getParameters() {
    return transformParameters(this.parameters) || {};
  }

  setParameters(value: Dictionary<ParameterValueSpecV1>) {
    this.parameters = value;
  }

  setParameter(key: string, value: ParameterValueSpecV1) {
    if (!this.parameters) {
      this.parameters = {};
    }
    this.parameters[key] = value;
  }

  getComponents(): Dictionary<ComponentConfig> {
    return transformComponents(this.components) || {};
  }

  setComponents(value: Dictionary<ComponentConfig | string>) {
    this.components = value;
  }

  setComponent(key: string, value: ComponentConfig | string) {
    if (!this.components) {
      this.components = {};
    }
    this.components[key] = value;
  }

  getVaults() {
    return this.vaults || {};
  }

  setVaults(value: Dictionary<EnvironmentVault>) {
    this.vaults = value;
  }

  setVault(key: string, value: EnvironmentVault) {
    if (!this.vaults) {
      this.vaults = {};
    }
    this.vaults[key] = value;
  }

  getInterfaces() {
    return transformComponentInterfaces(this.interfaces) || {};
  }

  setInterfaces(value: Dictionary<InterfaceSpecV1 | string>) {
    this.interfaces = value;
  }

  setInterface(key: string, value: InterfaceSpecV1 | string) {
    if (!this.interfaces) {
      this.interfaces = {};
    }
    this.interfaces[key] = value;
  }

  getContext(): EnvironmentContextV1 {
    const interfaces: Dictionary<InterfaceSpecV1> = {};
    for (const [ik, iv] of Object.entries(this.getInterfaces())) {
      interfaces[ik] = iv;
    }

    const parameters: Dictionary<ParameterValueSpecV1> = {};
    for (const [pk, pv] of Object.entries(this.getParameters())) {
      parameters[pk] = pv.default === undefined ? '' : pv.default;
    }

    const components: Dictionary<ComponentContextV1> = {};
    for (const [ck, cv] of Object.entries(this.getComponents())) {
      const normalized_ck = normalizeInterpolation(ck);
      components[normalized_ck] = cv.getContext();
    }

    return {
      interfaces,
      parameters,
      components,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateDictionary(expanded, 'parameters', errors, undefined, options, new RegExp(`^${Slugs.ComponentParameterRegexBase}$`));
    errors = await validateDictionary(expanded, 'components', errors, undefined, options, new RegExp(`^${ComponentVersionSlugUtils.RegexOptionalTag}$`));
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options);
    return errors;
  }
}
