import { plainToClass, serialize, Transform } from 'class-transformer';
import { Allow, IsBoolean, IsNotEmptyObject, IsObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ParameterValue, ServiceConfig } from '..';
import { ServiceInterfaceSpec } from '../service-config/base';
import { InterfaceSpecV1, transformParameters, transformServices } from '../service-config/v1';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { IMAGE_NAME_REGEX, REPOSITORY_NAME_REGEX, validateDictionary, validateInterpolation } from '../utils/validation';
import { ComponentConfig } from './base';

export class ParameterDefinitionSpecV1 extends BaseSpec {
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
  interfaces: Dictionary<ServiceInterfaceSpec>;
}

export interface ComponentContextV1 {
  dependencies: Dictionary<ComponentContextV1>;
  parameters: Dictionary<ParameterValue>;
  interfaces: Dictionary<ServiceInterfaceSpec>;
  services: Dictionary<ServiceContextV1>;
}

export const transformInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
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
  __version = '1.0.0';

  @IsOptional({
    groups: ['operator'],
  })
  @IsString({ always: true })
  @Matches(new RegExp(IMAGE_NAME_REGEX), {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(new RegExp(REPOSITORY_NAME_REGEX), {
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

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

  @Transform(transformServices)
  @IsOptional({ groups: ['operator'] })
  @IsNotEmptyObject({ groups: ['developer'] })
  services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  @Transform(value => {
    if (value) {
      const output: Dictionary<string> = {};
      for (const [k, v] of Object.entries(value)) {
        output[k] = `${v}`;
      }
      return output;
    }
  })
  dependencies?: Dictionary<string>;

  @Transform(transformInterfaces, { toClassOnly: true })
  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of components need to expose services' })
  interfaces?: Dictionary<InterfaceSpecV1>;

  getName() {
    return this.name.split(':')[0];
  }

  getRef() {
    return this.name.includes(':') ? this.name : `${this.name}:latest`;
  }

  getExtends() {
    return this.extends;
  }

  setExtends(ext: string) {
    this.extends = ext;
  }

  getDescription() {
    return this.description || '';
  }

  getKeywords() {
    return this.keywords || [];
  }

  getParameters() {
    return this.parameters || {};
  }

  getServices() {
    return this.services || {};
  }

  getDependencies() {
    return this.dependencies || {};
  }

  getInterfaces() {
    if (!this.interfaces) {
      this.interfaces = {};
    }
    return this.interfaces;
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

    const interfaces: Dictionary<ServiceInterfaceSpec> = {};
    for (const [ik, iv] of Object.entries(this.getInterfaces())) {
      interfaces[ik] = {
        ...interface_filler,
        ...iv,
      };
    }

    const services: Dictionary<ServiceContextV1> = {};
    for (const [sk, sv] of Object.entries(this.getServices())) {
      const interfaces: Dictionary<ServiceInterfaceSpec> = {};
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
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') });
    errors = await validateDictionary(this, 'interfaces', errors, undefined, options);
    if ((options.groups || []).includes('developer')) {
      errors = errors.concat(validateInterpolation(serialize(this), this.getContext(), ['dependencies.']));
    }
    return errors;
  }
}
