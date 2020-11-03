import { Type } from 'class-transformer';
import { Allow, IsEmpty, IsInstance, IsOptional, IsString } from 'class-validator';
import { ServiceConfigV1 } from '../service-config/v1';
import { TaskConfig } from './base';

//TODO:84:Tasks: let's rethink our abstraction patterns a bit here. There's a chance we don't want TaskConfig extending ServiceConfig
export class TaskConfigV1 extends ServiceConfigV1 implements TaskConfig {
  @Allow({ always: true })
  __version?: string;

  // TODO:84:Tasks: are there any cron parsers that we can use to validate?
  @IsOptional({ always: true })
  @IsString({ always: true })
  schedule?: string;

  @Type(() => TaskConfigV1)
  @IsOptional({ always: true })
  @IsInstance(TaskConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: TaskConfigV1;

  getSchedule(): string {
    return this.schedule || '';
  }

  setSchedule(schedule: string): void {
    this.schedule = schedule;
  }

  getDebugOptions(): TaskConfig | undefined {
    return this.debug;
  }

  setDebugOptions(value: TaskConfigV1) {
    this.debug = value;
  }
}
