import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig, VolumeSpec } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  image: string;
  tag?: string;
  service_config: ServiceConfig;
  replicas?: number;
  env_volumes?: { [s: string]: VolumeSpec };
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
  env_volumes?: { [s: string]: VolumeSpec };

  constructor(options: ServiceNodeOptions & DependencyNodeOptions) {
    super(options);
    if (options) {
      this.image = options.image;
      this.tag = options.tag || 'latest';
      this.service_config = options.service_config;
      this.env_volumes = options.env_volumes;
    }
  }

  get env_ref() {
    return this.ref.split(':')[0];
  }

  get ref() {
    return `${this.service_config.getName()}:${this.tag}`;
  }

  get api() {
    return this.service_config.getApiSpec();
  }

  /**
   * @override
   */
  get protocol() {
    return this.api.type === 'grpc' ? '' : 'http://';
  }

  get volumes(): { [s: string]: VolumeSpec } {
    return { ...this.service_config.getVolumes(), ...this.env_volumes };
  }
}
