import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  image: string;
  tag?: string;
  service_config: ServiceConfig;
  replicas?: number;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  image!: string;
  tag!: string;
  replicas = 1;
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

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    if (options) {
      this.image = options.image;
      this.tag = options.tag || 'latest';
      this.service_config = options.service_config;
    }
  }

  get env_ref() {
    return this.ref.split(':')[0];
  }

  get ref() {
    return `${this.service_config.getName()}:${this.tag}`;
  }

  get interfaces() {
    return this.service_config.getInterfaces();
  }

  /**
   * @override
   */
  get protocol() {
    return this.service_config.getApiSpec().type === 'grpc' ? '' : 'http://';
  }
}
