import { IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';

export abstract class SharedDebugSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  command?: string | string[];

  @IsOptional()
  entrypoint?: string | string[];

  @IsOptional()
  @IsString()
  dockerfile?: string;
}
