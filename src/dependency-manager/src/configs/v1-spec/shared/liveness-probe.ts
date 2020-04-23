import { IsNumber, IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';

export class LivenessProbeV1 extends BaseSpec {
  @IsOptional()
  @IsNumber()
  success_threshold?: number;

  @IsOptional()
  @IsNumber()
  failure_threshold?: number;

  @IsOptional()
  @IsString()
  timeout?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  interval?: string;
}