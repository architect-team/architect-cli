import { plainToClass, serialize, Transform } from 'class-transformer';
import { Allow, IsBoolean, IsNotEmptyObject, IsObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ParameterValue, ServiceConfig } from '..';
import { InterfaceSpec } from '../service-config/base';
import { InterfaceSpecV1, ServiceConfigV1, transformParameters } from '../service-config/v1';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { ComponentSlug, ComponentSlugUtils, ComponentVersionSlug, ComponentVersionSlugUtils, Slugs } from '../utils/slugs';
import { validateDictionary, validateInterpolation } from '../utils/validation';
import { ComponentConfig, ParameterDefinitionSpec } from './base';

export class ParameterDefinitionSpecV1 extends BaseSpec implements ParameterDefinitionSpec {
  @IsOptional({ always: true })
  @IsBoolean({ always: true })
  required?: boolean;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  default?: string | number | boolean;
}

export type ParameterValueSpecV1 = string | number | boolean | ParameterDefinitionSpecV1;

interface ServiceContextV1 {
  environment: Dictionary<string>;
  interfaces: Dictionary<InterfaceSpec>;
}

export interface ComponentContextV1 {
  dependencies: Dictionary<ComponentContextV1>;
  parameters: Dictionary<ParameterValue>;
  interfaces: Dictionary<InterfaceSpec>;
  services: Dictionary<ServiceContextV1>;
}

export function transformServices(input?: Dictionary<object | ServiceConfigV1>): Dictionary<ServiceConfigV1> {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    let config;
    if (value instanceof ServiceConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: key };
    } else {
      config = { name: key };
    }
    output[key] = plainToClass(ServiceConfigV1, config);
  }

  return output;
}

export const transformInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  // TODO: Be more flexible than just url ref
  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object && 'host' in value && 'port' in value) {
      output[key] = plainToClass(InterfaceSpecV1, value);
    } else {
      let host, port, protocol;
      let url = value instanceof Object ? value.url : value;

      const url_regex = new RegExp(`\\\${\\s*(.*?)\\.url\\s*}`, 'g');
      const matches = url_regex.exec(url);
      if (matches) {
        host = `\${ ${matches[1]}.host }`;
        port = `\${ ${matches[1]}.port }`;
        protocol = `\${ ${matches[1]}.protocol }`;
        url = `\${ ${matches[1]}.protocol }://\${ ${matches[1]}.host }:\${ ${matches[1]}.port }`;

        output[key] = plainToClass(InterfaceSpecV1, {
          host,
          port,
          protocol,
          url,
        });
      } else {
        throw new Error(`Invalid interface regex: ${url}`);
      }
    }
  }

  return output;
};

export class ComponentConfigV1 extends ComponentConfig {
  @Allow({ always: true })
  __version?: string;

  @IsOptional({
    groups: ['operator'],
  })
  @IsString({ always: true })
  @Matches(new RegExp(`^${Slugs.ArchitectSlugRegexBase}$`), {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(new RegExp(`^${ComponentSlugUtils.RegexBase}$`), {
    message: 'Names must be prefixed with an account name (e.g. architect/component-name)',
    groups: ['developer'],
  })
  name!: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  @Matches(/^(?!file:).*$/g, { groups: ['developer'], message: 'Cannot hardcode a filesystem location when registering a component' })
  extends?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsString({ each: true, always: true })
  keywords?: string[];

  @IsOptional({ always: true })
  @IsString({ always: true })
  author?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  parameters?: Dictionary<ParameterValueSpecV1>;

  @IsOptional({ groups: ['operator'] })
  @IsNotEmptyObject({ groups: ['developer'] })
  @Transform((value) => !value ? {} : value)
  services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  dependencies?: Dictionary<string>;

  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of components need to expose services' })
  @Transform((value) => !value ? {} : value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  getName(): ComponentSlug {
    let split;
    try {
      split = ComponentSlugUtils.parse(this.name);
    } catch {
      split = ComponentVersionSlugUtils.parse(this.name);
    }
    return ComponentSlugUtils.build(split.component_account_name, split.component_name);
  }

  getRef(): ComponentVersionSlug {
    let split;
    if (this.extends?.startsWith(`${this.name}:`)) {
      split = ComponentVersionSlugUtils.parse(this.extends);
    } else {
      try {
        split = ComponentSlugUtils.parse(this.name);
      } catch {
        split = ComponentVersionSlugUtils.parse(this.name);
      }
    }
    return ComponentVersionSlugUtils.build(split.component_account_name, split.component_name, split.tag);
  }

  getExtends() {
    return this.extends;
  }

  setExtends(ext: string) {
    this.extends = ext;
  }

  getLocalPath() {
    return this.getExtends()?.startsWith('file:') ? this.getExtends()?.substr('file:'.length) : undefined;
  }

  getDescription() {
    return this.description || '';
  }

  getKeywords() {
    return this.keywords || [];
  }

  getAuthor() {
    return this.author || '';
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

  getServices() {
    return transformServices(this.services) || {};
  }

  setServices(value: Dictionary<ServiceConfig>) {
    this.services = value;
  }

  setService(key: string, value: ServiceConfig) {
    if (!this.services) {
      this.services = {};
    }
    this.services[key] = value;
  }

  getDependencies() {
    const output: Dictionary<string> = {};
    for (const [k, v] of Object.entries(this.dependencies || {})) {
      output[k] = `${v}`;
    }
    return output;
  }

  getInterfaces() {
    return transformInterfaces(this.interfaces) || {};
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

  getContext(): ComponentContextV1 {
    const dependencies: Dictionary<any> = {};
    for (const dk of Object.keys(this.getDependencies())) {
      dependencies[dk] = {};
    }

    const parameters: Dictionary<ParameterValue> = {};
    for (const [pk, pv] of Object.entries(this.getParameters())) {
      parameters[pk] = pv.default === undefined ? '' : pv.default;
    }

    const interface_filler = {
      port: '',
      host: '',
      protocol: '',
      url: '',
    };

    const interfaces: Dictionary<InterfaceSpec> = {};
    for (const [ik, iv] of Object.entries(this.getInterfaces())) {
      interfaces[ik] = {
        ...interface_filler,
        ...iv,
      };
    }

    const services: Dictionary<ServiceContextV1> = {};
    for (const [sk, sv] of Object.entries(this.getServices())) {
      const interfaces: Dictionary<InterfaceSpec> = {};
      for (const [ik, iv] of Object.entries(sv.getInterfaces())) {
        interfaces[ik] = {
          ...interface_filler,
          ...iv,
        };
      }
      services[sk] = {
        interfaces,
        environment: sv.getEnvironmentVariables(),
      };
    }

    return {
      dependencies,
      parameters,
      interfaces,
      services,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateDictionary(expanded, 'parameters', errors, undefined, options, new RegExp(`^${Slugs.ComponentParameterRegexBase}$`));
    errors = await validateDictionary(expanded, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') }, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options);
    if ((options.groups || []).includes('developer')) {
      errors = errors.concat(validateInterpolation(serialize(expanded), this.getContext(), ['dependencies.']));
    }
    return errors;
  }
}
