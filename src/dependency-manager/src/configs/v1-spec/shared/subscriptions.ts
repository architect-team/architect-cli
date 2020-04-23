import { IsOptional, IsString } from 'class-validator';
import { BaseSpec } from '../../base-spec';
import { Dictionary } from '../../utils/dictionary';

export class EventSubscriptionSpecV1 extends BaseSpec {
  @IsString()
  uri!: string;

  @IsOptional()
  @IsString({ each: true })
  headers?: Dictionary<string>;
}