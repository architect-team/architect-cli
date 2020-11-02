import { ServiceConfig } from '../service-config/base';

export abstract class TaskConfig extends ServiceConfig {
  abstract __version?: string;
  abstract getSchedule(): string;

  abstract getDebugOptions(): TaskConfig | undefined;
  abstract setDebugOptions(value: TaskConfig): void;
}
