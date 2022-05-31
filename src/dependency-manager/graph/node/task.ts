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

  get is_external(): boolean {
    return false;
  }

  get is_local(): boolean {
    return this.local_path !== '';
  }

  get architect_ref(): string {
    let component_name;
    let tenant_name;
    if (this.config.metadata.instance_id) {
      [component_name, tenant_name] = this.config.metadata.instance_id.split('@');
    }
    return `architect.ref=${component_name}.tasks.${this.config.name}${tenant_name ? `@${tenant_name}` : ''}`;
  }
}
