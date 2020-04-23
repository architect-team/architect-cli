import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';

export class VolumeClaimSpecV1 extends BaseSpec {
  @IsString()
  mount_path!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  readonly?: boolean;
}