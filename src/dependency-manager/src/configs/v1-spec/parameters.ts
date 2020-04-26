import { ClassTransformOptions } from 'class-transformer';
import { IsBoolean, IsEmpty, IsOptional, IsString, ValidateIf, ValidatorOptions } from 'class-validator';
import { BaseSpec } from '../base-spec';
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
  @IsOptional()
  value_from?: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1 | ValueFromVaultSpecV1;

  @ValidateIf(obj => !obj.value_from)
  valueFrom?: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1 | ValueFromVaultSpecV1;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (this.value_from && this.value_from.hasOwnProperty('dependency')) {
      this.value_from = new ValueFromDependencySpecV1(this.value_from, options);
    } else if (this.value_from && this.value_from.hasOwnProperty('datastore')) {
      this.value_from = new ValueFromDatastoreSpecV1(this.value_from, options);
    } else if (this.value_from) {
      this.value_from = new ValueFromVaultSpecV1(this.value_from, options);
    }

    if (this.valueFrom && this.valueFrom.hasOwnProperty('dependency')) {
      this.valueFrom = new ValueFromDependencySpecV1(this.valueFrom, options);
    } else if (this.valueFrom && this.valueFrom.hasOwnProperty('datastore')) {
      this.valueFrom = new ValueFromDatastoreSpecV1(this.valueFrom, options);
    } else if (this.valueFrom) {
      this.value_from = new ValueFromVaultSpecV1(this.valueFrom, options);
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'value_from', errors, options);
    errors = await validateNested(this, 'valueFrom', errors, options);
    return errors;
  }
}

export class ParameterDefinitionSpecV1 extends ValueFromWrapperSpecV1 {
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf(obj => !obj.value_from && !obj.valueFrom && !obj.required)
  @IsOptional()
  default?: string | number | ValueFromWrapperSpecV1;

  constructor(plain?: any, options?: ClassTransformOptions) {
    super(plain, options);

    if (typeof this.default === 'object') {
      this.default = new ValueFromWrapperSpecV1(this.default, options);
    }
  }

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    if (this.default instanceof ValueFromWrapperSpecV1) {
      errors = await validateNested(this, 'default', errors, options);
    }
    return errors;
  }
}

export type ParameterValueSpecV1 = string | number | ParameterDefinitionSpecV1;
