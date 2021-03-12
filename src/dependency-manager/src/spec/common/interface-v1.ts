import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEmpty, IsNotEmpty, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { ValidatableConfig } from '../base-spec';

export class InterfaceSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  /* TODO: Figure out if we should share the interface spec
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode interface hosts when publishing services',
  })
  */
  @IsString({ always: true })
  host?: string;

  @ValidateIf(obj => obj.host, { groups: ['operator'] })
  @IsNotEmpty({ always: true })
  @Type(() => String)
  port!: string;

  @IsOptional({ always: true })
  protocol?: string;

  @IsOptional({ always: true })
  username?: string;

  @IsOptional({ always: true })
  password?: string;

  @IsOptional({ always: true })
  url?: string;

  @IsEmpty({
    groups: ['developer'],
  })
  @IsOptional({ always: true })
  @IsArray({ always: true })
  @ArrayUnique({ always: true })
  @IsUrl({}, { always: true, each: true })
  domains?: string[];
}
