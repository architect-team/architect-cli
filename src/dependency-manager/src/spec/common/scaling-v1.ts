import { Type } from 'class-transformer';
import { IsInstance, IsOptional, IsString } from 'class-validator';
import { ValidatableConfig } from '../base-spec';

export class ScalingMetricsSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @Type(() => String)
  cpu?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  memory?: string;
}

export class ScalingSpecV1 extends ValidatableConfig {
  @IsString({ always: true })
  @Type(() => String)
  min_replicas!: string;

  @IsString({ always: true })
  @Type(() => String)
  max_replicas!: string;

  @Type(() => ScalingMetricsSpecV1)
  @IsOptional({ always: true })
  @IsInstance(ScalingMetricsSpecV1, { always: true })
  metrics?: ScalingMetricsSpecV1;
}
