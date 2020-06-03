import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  image?: string;
  tag?: string;
  digest?: string;
  service_config: ServiceConfig;
  node_config: ServiceConfig;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  image?: string;
  tag!: string;
  digest?: string;
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

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super();
    if (options) {
      this.image = options.image;
      this.tag = options.tag || 'latest';
      this.digest = options.digest;
      this.service_config = options.service_config;
      this.node_config = options.node_config;
    }
  }

  get ref() {
    return this.node_config.getName();
  }

  get volumes() {
    return this.node_config.getVolumes();
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config.getInterfaces();
  }

  get is_local() {
    return false; // TODO build context
    //return this.node_config.getPath() !== undefined;
  }
}
