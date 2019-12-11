import { ServiceConfig } from '../../service-config/base';

export interface DependencyNodeOptions {
  image?: string;
  tag?: string;
  host?: string;
  ports: {
    target: number;
    expose: number;
  };
  service_config: ServiceConfig;
  parameters?: { [key: string]: string | number };
}

class DependencyState {
  action: ('create' | 'delete' | 'update' | 'no-op') = 'no-op';
  applied_at?: Date;
  failed_at?: Date;
}

export abstract class DependencyNode implements DependencyNodeOptions {
  abstract __type: string;
  tag = 'latest';
  host = '0.0.0.0';
  ports!: { target: number; expose: number };
  service_config!: ServiceConfig;
  parameters: { [key: string]: string | number } = {};
  image?: string;
  state?: DependencyState;

  protected constructor(options: DependencyNodeOptions) {
    if (options) {
      Object.assign(this, options);
    }
  }

  get name() {
    return this.service_config.getName();
  }

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  get ref() {
    return `${this.service_config.getName()}:${this.tag}`;
  }

  get protocol() {
    return '';
  }
}
