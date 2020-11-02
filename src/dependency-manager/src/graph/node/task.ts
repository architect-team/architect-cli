import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { TaskConfig } from '../../task-config/base';
import { TaskConfigV1 } from '../../task-config/v1';

export interface TaskNodeOptions {
  ref: string;
  node_config: TaskConfig;
  local_path?: string;
}

export class TaskNode extends DependencyNode implements TaskNodeOptions {
  __type = 'task';

  @Type(() => TaskConfigV1)
  node_config!: TaskConfig;

  ref!: string;
  local_path!: string;

  constructor(options: TaskNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.node_config = options.node_config;
      this.local_path = options.local_path || '';
    }
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config.getInterfaces();
  }

  get ports(): string[] {
    const ports = Object.values(this.interfaces).map((i) => i.port) as string[];
    return [...new Set(ports)];
  }

  get is_external() {
    return Object.keys(this.interfaces).length > 0 && Object.values(this.interfaces).every((i) => i.host);
  }

  get is_local() {
    return this.local_path !== '';
  }
}
