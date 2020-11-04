import { Type } from 'class-transformer';
import { IsEmpty, IsInstance, IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { ResourceConfigV1 } from '../common/v1';
import { validateDictionary, validateNested } from '../utils/validation';
import { TaskConfig } from './base';

export class TaskConfigV1 extends ResourceConfigV1 implements TaskConfig {
  @Type(() => TaskConfigV1)
  @IsOptional({ always: true })
  @IsInstance(TaskConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: TaskConfigV1;

  @IsOptional({ always: true })
  @IsString({ always: true })
  schedule?: string;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateNested(expanded, 'debug', errors, { ...options, groups: (options.groups || []).concat('debug') });
    // Hack to overcome conflicting IsEmpty vs IsNotEmpty with developer vs debug
    const volumes_options = { ...options };
    if (volumes_options.groups && volumes_options.groups.includes('debug')) {
      volumes_options.groups = ['debug'];
    }
    errors = await validateDictionary(expanded, 'environment', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(expanded, 'volumes', errors, undefined, volumes_options);
    return errors;
  }

  getDebugOptions(): TaskConfigV1 | undefined {
    return this.debug;
  }

  setDebugOptions(value: TaskConfigV1) {
    this.debug = value;
  }

  getSchedule(): string {
    return this.schedule || '';
  }
}
