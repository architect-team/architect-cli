import { IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';

export class InterfacesSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  default?: boolean;

  @IsNumber()
  port!: number;
}
