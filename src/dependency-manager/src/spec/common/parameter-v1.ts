import { IsBooleanString, IsOptional, IsString } from 'class-validator';
import { ValidatableConfig } from '../base-spec';
import { ParameterDefinitionSpec } from './parameter-spec';

export class ParameterDefinitionSpecV1 extends ValidatableConfig implements ParameterDefinitionSpec {
  @IsOptional({ always: true })
  @IsBooleanString({ always: true })
  required?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  default?: string | number | boolean | null;
}

export type ParameterValueSpecV1 = string | number | boolean | ParameterDefinitionSpecV1;
