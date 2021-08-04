import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { validateNested } from '../..';
import { AtLeastOne } from '../../utils/validators/at-least-one';
import { ValidatableConfig } from '../base-spec';

//TODO:269:delete
export class ScalingMetricsSpecV1 extends ValidatableConfig {
  @IsOptional({ always: true })
  @Type(() => String)
  cpu?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  memory?: string;
}

//TODO:269:delete
export class ScalingSpecV1 extends ValidatableConfig {
  @IsString({ always: true })
  @Type(() => String)
  min_replicas!: string;

  @IsString({ always: true })
  @Type(() => String)
  max_replicas!: string;

  @AtLeastOne(['cpu', 'memory'], { always: true, message: `Either a cpu metric, a memory metric, or both must be defined.` })
  @Type(() => ScalingMetricsSpecV1)
  metrics!: ScalingMetricsSpecV1;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    if (errors.length) return errors;
    errors = await validateNested(this, 'metrics', errors, options);
    return errors;
  }
}
