import { Transform } from 'class-transformer';
import { Allow, IsEmpty, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { ServiceConfig } from '..';
import { ParameterValueV2 } from '../service-config/base';
import { transformParameters, transformServices } from '../service-config/v1';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary } from '../utils/validation';
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
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a filesystem location when registering a service',
  })
  @IsString({ always: true })
  path?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  extends?: string;

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  parameters?: Dictionary<ParameterValueV2>;

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
    if (this.path) {
      return `file:${this.path}`;
    }
    return this.extends;
  }

  setExtends(ext: string) {
    this.path = undefined;
    this.extends = ext;
  }

  getParameters() {
    return this.parameters || {};
  }

  getServices() {
    return this.services || {};
  }
}
