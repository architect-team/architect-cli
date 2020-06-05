import { Transform } from 'class-transformer';
import { Allow, IsNotEmptyObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ServiceConfig } from '..';
import { transformParameters, transformServices } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { IMAGE_NAME_REGEX, REPOSITORY_NAME_REGEX, validateDictionary } from '../utils/validation';
import { ParameterDefinitionSpecV1 } from '../v1-spec/parameters';
import { ComponentConfig } from './base';

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
    message: 'Names must be prefixed with an account name (e.g. architect/service-name)',
    groups: ['developer'],
  })
  name!: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
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

  async validate(options?: ValidatorOptions) {
    if (!options) options = {};
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'services', errors, undefined, { ...options, groups: (options.groups || []).concat('component') });
    return errors;
  }

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
}
