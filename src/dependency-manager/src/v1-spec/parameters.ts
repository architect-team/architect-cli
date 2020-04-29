import { plainToClass, Transform } from 'class-transformer';
import { IsBoolean, IsEmpty, IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { BaseSpec } from '../utils/base-spec';
import { validateNested } from '../utils/validation';

export class ValueFromDependencySpecV1 extends BaseSpec {
  @IsEmpty({
    groups: ['operator'],
    message: 'Service values are only accessible to direct consumers',
  })
  @IsString({
    groups: ['developer'],
  })
  dependency!: string;

  @IsOptional()
  @IsString()
  interface?: string;

  @IsString({
    groups: ['developer'],
  })
  value!: string;
}

export class ValueFromDatastoreSpecV1 extends BaseSpec {
  @IsEmpty({
    groups: ['operator'],
    message: 'Datastore values are only accessible to direct consumers',
  })
  @IsString({
    groups: ['developer'],
  })
  datastore!: string;

  @IsString({
    groups: ['developer'],
  })
  value!: string;
}

export class ValueFromVaultSpecV1 extends BaseSpec {
  @IsEmpty({
    groups: ['developer'],
    message: 'Services cannot hardcode references to private secret stores',
  })
  @IsString({
    groups: ['developer'],
  })
  vault!: string;

  @IsString({
    groups: ['developer'],
  })
  key!: string;
}

export class ValueFromWrapperSpecV1 extends BaseSpec {
  @Transform(valueFrom => {
    if (valueFrom.hasOwnProperty('dependency')) {
      return plainToClass(ValueFromDependencySpecV1, valueFrom);
    } else if (valueFrom.hasOwnProperty('datastore')) {
      return plainToClass(ValueFromDatastoreSpecV1, valueFrom);
    } else {
      return plainToClass(ValueFromVaultSpecV1, valueFrom);
    }
  })
  valueFrom!: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1 | ValueFromVaultSpecV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'valueFrom', errors, options);
    return errors;
  }
}

export class ParameterDefinitionSpecV1 extends BaseSpec {
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  build_arg?: boolean;

  @Transform(value => {
    switch (typeof value) {
      case 'string':
      case 'number':
        return value;
      case 'object':
        return plainToClass(ValueFromWrapperSpecV1, value);
      default:
        return undefined;
    }
  })
  @IsOptional()
  default?: string | number | ValueFromWrapperSpecV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    if (this.default instanceof ValueFromWrapperSpecV1) {
      errors = await validateNested(this, 'default', errors, options);
    }
    return errors;
  }
}

export type ParameterValueSpecV1 = string | number | ParameterDefinitionSpecV1;
