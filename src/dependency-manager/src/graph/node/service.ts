import { Transform } from 'class-transformer';
import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig } from '../../service-config/base';
import { ServiceConfigBuilder } from '../../service-config/builder';

export interface ServiceNodeOptions {
  image: string;
  tag?: string;
  digest?: string;
  service_config: ServiceConfig;
  node_config: ServiceConfig;
}

export class ServiceNode extends DependencyNode implements ServiceNodeOptions {
  __type = 'service';

  image!: string;
  tag!: string;
  digest?: string;

  @Transform(value => ServiceConfigBuilder.buildFromJSON(value), { toClassOnly: true })
  service_config!: ServiceConfig;

  @Transform(value => ServiceConfigBuilder.buildFromJSON(value), { toClassOnly: true })
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

  get env_ref() {
    return this.ref.split(':')[0];
  }

  get ref() {
    return `${this.node_config.getName()}:${this.tag}`;
  }

  get volumes() {
    return this.node_config.getVolumes();
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config.getInterfaces();
  }

  get parameters() {
    if (!this._parameters) {
      this._parameters = {};
      for (const [key, value] of Object.entries(this.node_config.getParameters())) {
        if ('default' in value && value.default !== undefined) {
          this._parameters[key] = value.default;
        }
      }
    }
    return this._parameters;
  }

  /**
   * @override
   */
  get protocol() {
    return this.node_config.getApiSpec().type === 'grpc' ? '' : 'http://';
  }
}
