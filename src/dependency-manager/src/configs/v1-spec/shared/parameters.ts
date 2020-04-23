import { IsBoolean, IsOptional, IsString, ValidateIf } from 'class-validator';
import { BaseSpec } from '../../base-spec';
import { validateNested } from '../../utils/validation';

export class ValueFromDependencySpecV1 extends BaseSpec {
  @IsString()
  dependency!: string;

  @IsString()
  value!: string;
}

export class ValueFromDatastoreSpecV1 extends BaseSpec {
  @IsString()
  datastore!: string;

  @IsString()
  value!: string;
}

export class ParameterValueFromWrapperV1 extends BaseSpec {
  @IsOptional()
  value_from?: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1;

  @ValidateIf(obj => !obj.value_from)
  valueFrom?: ValueFromDependencySpecV1 | ValueFromDatastoreSpecV1;

  constructor(plain?: any) {
    super(plain);

    if (this.value_from && this.value_from.hasOwnProperty('dependency')) {
      this.value_from = new ValueFromDependencySpecV1(this.value_from);
    } else if (this.value_from) {
      this.value_from = new ValueFromDatastoreSpecV1(this.value_from);
    }

    if (this.valueFrom && this.valueFrom.hasOwnProperty('dependency')) {
      this.valueFrom = new ValueFromDependencySpecV1(this.valueFrom);
    } else if (this.valueFrom) {
      this.valueFrom = new ValueFromDatastoreSpecV1(this.valueFrom);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'value_from', errors);
    errors = await validateNested(this, 'valueFrom', errors);
    return errors;
  }
}

export class ParameterDefinitionSpecV1 extends ParameterValueFromWrapperV1 {
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateIf(obj => !obj.value_from && !obj.valueFrom && !obj.required)
  @IsOptional()
  default?: string | number | ParameterValueFromWrapperV1;

  constructor(plain?: any) {
    super(plain);

    if (typeof this.default === 'object') {
      this.default = new ParameterValueFromWrapperV1(this.default);
    }
  }

  async validate() {
    let errors = await super.validate();
    errors = await validateNested(this, 'value_from', errors);
    errors = await validateNested(this, 'valueFrom', errors);
    if (this.default instanceof ParameterValueFromWrapperV1) {
      errors = await validateNested(this, 'default', errors);
    }
    return errors;
  }
}

export type ParameterValueSpecV1 = string | number | ParameterDefinitionSpecV1;