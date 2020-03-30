import { Transform, Type } from 'class-transformer/decorators';
import { ServiceApiSpec, ServiceConfig, ServiceDatastore, ServiceDebugOptions, ServiceEventNotifications, ServiceEventSubscriptions, ServiceInterfaceSpec, ServiceParameter } from './base';

interface ServiceNotificationsV1 {
  [notification_name: string]: {
    description: string;
  };
}

interface ServiceSubscriptionsV1 {
  [service_name: string]: {
    [event_name: string]: {
      uri: string;
      headers?: { [key: string]: string };
    };
  };
}

interface ServiceDatastoreV1 {
  host?: string;
  port?: number;
  image?: string;
  docker?: {
    image: string;
    target_port: number;
  };
  parameters: {
    [key: string]: ServiceParameterV1;
  };
}

interface ServiceParameterV1 {
  description?: string;
  default?: string | number;
  required?: boolean;
  build_arg?: boolean;
}

class LivenessProbeV1 {
  success_threshold?: number;
  failure_threshold?: number;
  timeout?: string;
  path?: string;
  interval?: string;
}

class ApiSpecV1 {
  type = 'rest';
  definitions?: string[];
  @Transform(value => ({ path: '/', success_threshold: 1, failure_threshold: 1, timeout: '5s', interval: '30s', ...value }))
  liveness_probe?: LivenessProbeV1;
}

class InterfaceSpecV1 {
  description?: string;
  port?: number;
}

export class ServiceConfigV1 extends ServiceConfig {
  __version = '1.0.0';
  name = '';
  description?: string;
  keywords?: string[];
  image?: string;
  port?: string;
  command?: string | string[];
  dependencies: { [s: string]: string } = {};
  language?: string;
  debug?: string;
  parameters: { [s: string]: ServiceParameterV1 } = {};
  datastores: { [s: string]: ServiceDatastoreV1 } = {};
  @Type(() => ApiSpecV1)
  api: ApiSpecV1 = {
    type: 'rest',
  };
  interfaces: { [s: string]: InterfaceSpecV1 } = {};
  notifications: ServiceNotificationsV1 = {};
  subscriptions: ServiceSubscriptionsV1 = {};
  platforms: { [s: string]: any } = {};

  private normalizeParameters(parameters: { [s: string]: ServiceParameterV1 }): { [s: string]: ServiceParameter } {
    return Object.keys(parameters).reduce((res: { [s: string]: ServiceParameter }, key: string) => {
      const param = parameters[key];
      res[key] = {
        default: param.default,
        required: param.required !== false && !('default' in param),
        description: param.description || '',
        build_arg: param.build_arg,
      };
      return res;
    }, {});
  }

  getName(): string {
    return this.name;
  }

  getApiSpec(): ServiceApiSpec {
    return this.api;
  }

  getInterfaces(): { [name: string]: ServiceInterfaceSpec } {
    return this.interfaces;
  }

  getImage(): string {
    return this.image || '';
  }

  getCommand(): string | string[] {
    return this.command || '';
  }

  getDependencies(): { [s: string]: string } {
    return this.dependencies || {};
  }

  addDependency(name: string, tag: string) {
    this.dependencies[name] = tag;
  }

  removeDependency(dependency_name: string) {
    delete this.dependencies[dependency_name];
  }

  getParameters(): { [s: string]: ServiceParameter } {
    return this.normalizeParameters(this.parameters);
  }

  getDatastores(): { [s: string]: ServiceDatastore } {
    return Object.keys(this.datastores)
      .reduce((res: { [s: string]: ServiceDatastore }, key: string) => {
        const ds_config = this.datastores[key];
        if (ds_config.image) {
          if (!ds_config.port) {
            throw new Error('Missing datastore port which is required for provisioning');
          }

          res[key] = {
            docker: {
              image: ds_config.image,
              target_port: ds_config.port,
            },
            parameters: this.normalizeParameters(ds_config.parameters || {}),
          };
          return res;
        } else if (ds_config.docker) {
          res[key] = {
            docker: ds_config.docker,
            parameters: this.normalizeParameters(ds_config.parameters || {}),
          };
          return res;
        }

        throw new Error('Missing datastore docker config which is required for provisioning');
      }, {});
  }

  getNotifications(): ServiceEventNotifications {
    return this.notifications;
  }

  getSubscriptions(): ServiceEventSubscriptions {
    return Object.keys(this.subscriptions)
      .reduce((res: ServiceEventSubscriptions, service_name: string) => {
        const events = this.subscriptions[service_name];
        Object.keys(events).forEach(event_name => {
          if (!res[service_name]) {
            res[service_name] = {};
          }

          res[service_name][event_name] = {
            type: 'rest',
            data: {
              uri: events[event_name].uri,
              headers: events[event_name].headers,
            },
          };
        });
        return res;
      }, {});
  }

  getDebugOptions(): ServiceDebugOptions | undefined {
    return this.debug ? { command: this.debug } : undefined;
  }

  getLanguage(): string {
    if (!this.language) {
      throw new Error(`Missing language for service, ${this.name}`);
    }

    return this.language;
  }

  getPlatforms(): { [s: string]: any } {
    return this.platforms;
  }

  getPort(): number | undefined {
    return this.port ? Number(this.port) : undefined;
  }
}
