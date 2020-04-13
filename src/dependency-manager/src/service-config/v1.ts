import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { Dict } from '../utils/transform';
import { ServiceApiSpec, ServiceConfig, ServiceDatastore, ServiceDebugOptions, ServiceEventNotifications, ServiceEventSubscriptions, ServiceInterfaceSpec, ServiceParameter, VolumeSpec } from './base';

function transformParameters(input: any) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    if (value instanceof Object && !value.valueFrom) {
      output[key] = value;
    } else {
      output[key] = { default: value };
    }
  }
  return output;
}

function transformVolumes(input: any) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object) {
      output[key] = value;
    } else {
      output[key] = { host_path: value };
    }
  }
  return output;
}

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

class ServiceDatastoreV1 {
  host?: string;
  port?: number;
  image?: string;
  @Transform(value => (transformParameters(value)))
  parameters: { [key: string]: ServiceParameterV1 } = {};
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
  host?: string;
  port!: number;
}

export class ServiceVolumeV1 {
  mount_path?: string;
  host_path?: string;
  description?: string;
  readonly?: boolean;
}

class ServiceDebugOptionsV1 {
  path?: string;
  dockerfile?: string;
  @Transform(value => (transformVolumes(value)))
  volumes?: { [s: string]: ServiceVolumeV1 };
  command?: string | string[];
  entrypoint?: string | string[];
}

interface IngressSpecV1 {
  subdomain: string;
}

export class ServiceConfigV1 extends ServiceConfig {
  __version = '1.0.0';
  name?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  host?: string;
  port?: string;
  command?: string | string[];
  entrypoint?: string | string[];
  dockerfile?: string;
  dependencies: { [s: string]: string } = {};
  language?: string;
  @Transform(value => (value instanceof Object ? plainToClass(ServiceDebugOptionsV1, value) : (value ? { command: value } : value)), { toClassOnly: true })
  debug?: ServiceDebugOptionsV1;
  @Transform(value => (transformParameters(value)))
  parameters: { [s: string]: ServiceParameterV1 } = {};
  @Transform(Dict(() => ServiceDatastoreV1), { toClassOnly: true })
  datastores: { [s: string]: ServiceDatastoreV1 } = {};
  @Type(() => ApiSpecV1)
  api: ApiSpecV1 = {
    type: 'rest',
  };
  interfaces: { [s: string]: InterfaceSpecV1 } = {};
  notifications: ServiceNotificationsV1 = {};
  subscriptions: ServiceSubscriptionsV1 = {};
  platforms: { [s: string]: any } = {};
  @Transform(value => (transformVolumes(value)))
  volumes: { [s: string]: ServiceVolumeV1 } = {};
  ingress?: IngressSpecV1;
  replicas = 1;

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
    return this.name || '';
  }

  getApiSpec(): ServiceApiSpec {
    return this.api;
  }

  getInterfaces(): { [name: string]: ServiceInterfaceSpec } {
    const _default = this.port ? parseInt(this.port) : 8080;
    return Object.keys(this.interfaces).length ? this.interfaces : { _default: { host: this.host, port: _default } };
  }

  getImage(): string {
    return this.image || '';
  }

  getCommand() {
    return this.command || '';
  }

  getEntrypoint() {
    return this.entrypoint || '';
  }

  getDockerfile() {
    return this.dockerfile;
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
            ...ds_config,
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
    return this.debug;
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

  getVolumes(): { [s: string]: VolumeSpec } {
    return Object.entries(this.volumes).reduce((volumes, [key, entry]) => {
      if (entry.readonly !== true && entry.readonly !== false) {
        // Set readonly to false by default
        entry.readonly = false;
      }

      volumes[key] = entry as VolumeSpec;
      return volumes;
    }, {} as { [key: string]: VolumeSpec });
  }

  getIngress() {
    return this.ingress;
  }

  getReplicas() {
    return this.replicas;
  }
}
