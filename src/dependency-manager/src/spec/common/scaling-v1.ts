import { Type } from 'class-transformer';
import { IsInstance, IsOptional } from 'class-validator';
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
  @IsOptional({ always: true })
  @Type(() => String)
  min_replicas?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  max_replicas?: string;

  @IsOptional({ always: true })
  @IsInstance(ScalingMetricsSpecV1, { always: true })
  metrics?: ScalingMetricsSpecV1;
}
