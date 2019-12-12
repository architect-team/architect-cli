import { Type } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { DatastoreValueFromParameter, ValueFromParameter } from '../../manager';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigV1 } from '../../service-config/v1';

export interface ServiceNodeOptions {
  image: string;
  tag?: string;
  service_config: ServiceConfig;
  parameters?: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  image!: string;
  tag = 'latest';
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
}
