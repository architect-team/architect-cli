import { serialize, Transform } from 'class-transformer';
import { Allow, IsBoolean, IsNotEmptyObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ParameterValue, ServiceConfig } from '..';
import { transformParameters, transformServices } from '../service-config/v1';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { InterfaceContext, interpolateString } from '../utils/interpolation';
import { IMAGE_NAME_REGEX, REPOSITORY_NAME_REGEX, validateDictionary } from '../utils/validation';
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
  interfaces: Dictionary<InterfaceContext>;
}

interface ComponentContextV1 {
  dependencies: Dictionary<ComponentContextV1>;
  parameters: Dictionary<ParameterValue>;
  services: Dictionary<ServiceContextV1>;
}

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

  getParameters() {
    return this.parameters || {};
  }

  getServices() {
    return this.services || {};
  }

  getDependencies() {
    return this.dependencies || {};
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

    const services: Dictionary<ServiceContextV1> = {};
    for (const [sk, sv] of Object.entries(this.getServices())) {
      const interfaces: Dictionary<InterfaceContext> = {};
      for (const [ik, iv] of Object.entries(sv.getInterfaces())) {
        const interface_filler = {
          port: 8080,
          host: '',
          protocol: '',
          url: '',
          subdomain: '',
        };
        interfaces[ik] = {
          ...interface_filler,
          ...iv,
          internal: interface_filler,
          external: interface_filler,
        };
      }
      services[sk] = {
        interfaces,
      };
    }

    return {
      dependencies,
      parameters,
      services,
    };
  }

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') });
    if ('developer' in (options.groups || [])) {
      interpolateString(serialize(this), this.getContext(), ['dependencies.', 'interfaces.']);
    }
    return errors;
  }
}
