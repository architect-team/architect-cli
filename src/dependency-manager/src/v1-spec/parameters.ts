import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../utils/base-spec';

/*
export class ValueFromDependencySpecV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['operator'],
    message: 'Service values are only accessible to direct consumers',
  })
  @IsString({
    groups: ['developer'],
  })
  dependency!: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
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
    groups: ['operator'],
  })
  vault!: string;

  @IsString({
    groups: ['operator'],
  })
  key!: string;
}

export class ValueFromWrapperSpecV1 extends BaseSpec {
  @Transform(valueFrom => {
    if (valueFrom.hasOwnProperty('dependency') || valueFrom.hasOwnProperty('interface')) {
      return plainToClass(ValueFromDependencySpecV1, valueFrom);
    } else if (valueFrom.hasOwnProperty('datastore')) {
      return plainToClass(ValueFromDatastoreSpecV1, valueFrom);
    } else {
      return plainToClass(ValueFromVaultSpecV1, valueFrom);
    }
  })
  @IsDefined({ always: true })
  valueFrom!: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1 | ValueFromVaultSpecV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'valueFrom', errors, options);
    return errors;
  }
}
*/

export class ParameterDefinitionSpecV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsBoolean({ always: true })
  required?: boolean;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @Transform(value => {
    if (value instanceof Object) {
      const value_from = value.valueFrom;
      if (value_from.dependency) {
        return `\${ dependencies['${value_from.dependency}'].services.service.parameters.${value_from.value} }`;
      } else if (value_from.interface) {
        return '';
      } else if (value_from.datastore) {
        return `\${ services['datastore-${value_from.datastore}'].parameters.${value_from.value} }`;
      } else {
        return 'TODO: support vault';
      }
    } else {
      return value;
    }
  })
  @IsOptional({ always: true })
  default?: string | number | boolean;
}

export type ParameterValueSpecV1 = string | number | boolean | ParameterDefinitionSpecV1;
