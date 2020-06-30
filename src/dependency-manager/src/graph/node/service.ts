import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  ref: string;
  service_config: ServiceConfig;
  node_config: ServiceConfig;
  local_path?: string;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  // TODO: Remove
  @Type(() => ServiceConfig, {
    discriminator: {
      property: '__version',
      subTypes: [
        { value: ServiceConfigV1, name: '1.0.0' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  service_config!: ServiceConfig;

  @Type(() => ServiceConfig, {
    discriminator: {
      property: '__version',
      subTypes: [
        { value: ServiceConfigV1, name: '1.0.0' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  node_config!: ServiceConfig;

  ref!: string;
  local_path!: string;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.ref = options.ref;
      this.service_config = options.service_config;
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
