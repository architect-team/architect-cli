import { IsNumber, IsOptional, IsString, IsUrl, ValidateIf } from 'class-validator';
import { BaseSpec } from '../../base-spec';

export class InterfacesSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  default?: boolean;

  @IsOptional()
  @IsString()
  @IsUrl()
  host?: string;

  @ValidateIf(obj => !obj.host)
  @IsNumber()
  port?: number;
}
