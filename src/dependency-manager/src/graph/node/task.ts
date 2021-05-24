import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { TaskConfig } from '../../spec/task/task-config';
import { TaskConfigV1 } from '../../spec/task/task-v1';

export interface TaskNodeOptions {
  ref: string;
  config: TaskConfig;
  local_path?: string;
}

export class TaskNode extends DependencyNode implements TaskNodeOptions {
  __type = 'task';

  @Type(() => TaskConfigV1)
  config!: TaskConfig;

  ref!: string;
  local_path!: string;

  constructor(options: TaskNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.config = options.config;
      this.local_path = options.local_path || '';
    }
  }

  get interfaces(): { [key: string]: any } {
    return {};
  }

  get ports(): string[] {
    return [];
  }

  get is_external() {
    return false;
  }

  get is_local() {
    return this.local_path !== '';
  }
}
