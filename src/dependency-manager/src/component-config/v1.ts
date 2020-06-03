import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ServiceConfig } from '..';
import { transformParameters, transformServices } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary } from '../utils/validation';
import { ParameterDefinitionSpecV1 } from '../v1-spec/parameters';
import { ComponentConfig } from './base';

export class ComponentConfigV1 extends ComponentConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @IsOptional({
    groups: ['operator'],
  })
  @IsString({ always: true })
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(/^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/, {
    message: 'Names must be prefixed with an account name (e.g. architect/service-name)',
    groups: ['developer'],
  })
  name?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  extends?: string;

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

  @Transform(transformServices)
  @IsOptional({ always: true })
  services?: Dictionary<ServiceConfig>;

  @IsOptional({ always: true })
  dependencies?: Dictionary<string>;

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') });
    return errors;
  }

  getName() {
    return this.name || '';
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

  getContext() {
    const flat_parameters: any = {};
    for (const [parameter_key, parameter] of Object.entries(this.getParameters())) {
      flat_parameters[parameter_key] = parameter.default;
    }

    let flat_interfaces: any = {}; // Backwards compat for old service architect.json
    for (const service of Object.values(this.getServices())) {
      flat_interfaces = { ...flat_interfaces, ...service.getInterfaces() };
    }

    return {
      interfaces: flat_interfaces,
      parameters: flat_parameters,
      services: this.getServices(),
    };
  }
}
