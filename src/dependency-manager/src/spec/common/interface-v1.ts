import { Type } from 'class-transformer';
import { IsBooleanString, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ValidatableConfig } from '../base-spec';

//TODO:269:delete
export class InterfaceSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  host?: string;

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

  @IsOptional({ always: true })
  @IsBooleanString({ always: true })
  sticky?: string;
}
