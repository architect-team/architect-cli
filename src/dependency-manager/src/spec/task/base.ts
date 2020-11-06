import { ResourceConfig } from '../resource/base';

export interface TaskConfig extends ResourceConfig {
  __version?: string;

  getDebugOptions(): TaskConfig | undefined;
  setDebugOptions(value: TaskConfig): void;

  getSchedule(): string;
}
