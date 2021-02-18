import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { TaskConfig } from '../../spec/task/task-config';
import { TaskConfigV1 } from '../../spec/task/task-v1';

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
    return {};
  }

  get ports(): string[] {
    const ports = Object.values(this.interfaces).map((i) => i.port) as string[];
    return [...new Set(ports)];
  }

  get is_external() {
    return Object.keys(this.interfaces).length > 0 && Object.values(this.interfaces).every((i) => i.host && !i.host.startsWith('${{')); // a node cannot be determined to actually be external until its value is either set directly or interpolated
  }

  get is_local() {
    return this.local_path !== '';
  }
}
