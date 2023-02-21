import { DependencyNode, DependencyNodeOptions } from '.';
import { TaskConfig } from '../../config/task-config';

export interface TaskNodeOptions {
  ref: string;
  config: TaskConfig;
  local_path?: string;
}

export class TaskNode extends DependencyNode implements TaskNodeOptions {
  __type = 'task';

  config!: TaskConfig;

  ref!: string;
  local_path?: string;

  constructor(options: TaskNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.config = options.config;
      this.local_path = options.local_path;
    }
  }

  get interfaces(): { [key: string]: any } {
    return {};
  }

  get ports(): string[] {
    return [];
  }

  get is_external(): boolean {
    return false;
  }
}
