import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { ValidatableConfig } from '../base-spec';
import { ParameterDefinitionSpec } from './parameter-spec';

export class ParameterDefinitionSpecV1 extends ValidatableConfig implements ParameterDefinitionSpec {
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
