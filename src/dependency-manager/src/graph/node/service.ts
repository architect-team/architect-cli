import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  service_config: ServiceConfig;
  node_config: ServiceConfig;
  local?: boolean;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

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

  local = false;

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.service_config = options.service_config;
      this.node_config = options.node_config;
      this.local = options.local || false;
    }
  }

  get ref() {
    return this.node_config.getName();
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config.getInterfaces();
  }

  get is_local() {
    return this.local;
  }
}
