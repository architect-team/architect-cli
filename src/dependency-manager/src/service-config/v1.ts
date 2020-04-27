import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { IsBoolean, IsEmpty, IsInstance, IsNumber, IsOptional, IsString, ValidatorOptions } from 'class-validator';
import { ParameterValue } from '../manager';
import { Dictionary } from '../utils/dictionary';
import { Dict } from '../utils/transform';
import { validateDictionary, validateNested } from '../utils/validation';
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
    output[key] = value instanceof Object ? value : { host_path: value };
  }
  return output;
}

function transformInterfaces(input: any) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object ? value : { port: value };
  }
  return output;
}

class DockerComposePlatformSpecV1 {
  @IsOptional()
  @IsBoolean()
  privileged?: boolean;

  @IsOptional()
  @IsString()
  stop_signal?: string;
}

class PlatformsSpecV1 {
  @Type(() => DockerComposePlatformSpecV1)
  @IsOptional()
  @IsInstance(DockerComposePlatformSpecV1)
  'docker-compose'?: DockerComposePlatformSpecV1;
}

class NotificationSpecV1 {
  @IsString()
  description!: string;
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

class ServiceParameterV1 {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  default?: ParameterValue;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
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
  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  dockerfile?: string;

  @Transform(value => (transformVolumes(value)))
  @IsOptional()
  volumes?: { [s: string]: ServiceVolumeV1 };

  @IsOptional()
  command?: string | string[];

  @IsOptional()
  entrypoint?: string | string[];
}

class IngressSpecV1 {
  @IsEmpty({
    groups: ['developer'],
  })
  @IsString()
  subdomain!: string;
}

export class ServiceConfigV1 extends ServiceConfig {
  __version = '1.0.0';

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsString()
  image?: string;

  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsString()
  port?: string;

  @IsOptional()
  command?: string | string[];

  @IsOptional()
  entrypoint?: string | string[];

  @IsOptional()
  dockerfile?: string;

  @IsOptional()
  dependencies?: Dictionary<string>;

  @IsOptional()
  @IsString()
  language?: string;

  @Transform(value =>
    value instanceof Object
      ? plainToClass(ServiceDebugOptionsV1, value)
      : value,
    { toClassOnly: true })
  @IsOptional()
  debug?: string | ServiceDebugOptionsV1;

  @Transform(value => (transformParameters(value)))
  @IsOptional()
  parameters?: { [s: string]: ServiceParameterV1 };

  @Transform(Dict(() => ServiceDatastoreV1), { toClassOnly: true })
  @IsOptional()
  datastores?: { [s: string]: ServiceDatastoreV1 } = {};

  @Type(() => ApiSpecV1)
  @IsOptional()
  @IsInstance(ApiSpecV1)
  api?: ApiSpecV1;

  @Transform(value => (transformInterfaces(value)))
  interfaces: { [s: string]: InterfaceSpecV1 } = {};

  @Transform(Dict(() => NotificationSpecV1), { toClassOnly: true })
  @IsOptional()
  notifications?: Dictionary<NotificationSpecV1>;

  @IsOptional()
  subscriptions?: ServiceSubscriptionsV1;

  @Type(() => PlatformsSpecV1)
  @IsOptional()
  @IsInstance(PlatformsSpecV1)
  platforms?: PlatformsSpecV1;

  @Transform(value => (transformVolumes(value)))
  @IsOptional()
  volumes?: { [s: string]: ServiceVolumeV1 };

  @Type(() => IngressSpecV1)
  @IsOptional()
  @IsInstance(IngressSpecV1)
  ingress?: IngressSpecV1;

  @IsOptional()
  @IsNumber()
  replicas?: number;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    if (this.debug instanceof ServiceDebugOptionsV1) {
      errors = await validateNested(this, 'debug', errors, options);
    }
    errors = await validateNested(this, 'api', errors, options);
    errors = await validateDictionary(this, 'notifications', errors, undefined, options);
    errors = await validateNested(this, 'platforms', errors, options);
    errors = await validateNested(this, 'ingress', errors, options);
    return errors;
  }

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
    return this.api || { type: 'rest' };
  }

  getInterfaces(): { [name: string]: ServiceInterfaceSpec } {
    return this.interfaces;
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
    this.dependencies = this.dependencies || {};
    this.dependencies[name] = tag;
  }

  removeDependency(dependency_name: string) {
    if (this.dependencies) {
      delete this.dependencies[dependency_name];
    }
  }

  getParameters(): { [s: string]: ServiceParameter } {
    return this.normalizeParameters(this.parameters || {});
  }

  getDatastores(): { [s: string]: ServiceDatastore } {
    return Object.keys(this.datastores || {})
      .reduce((res: { [s: string]: ServiceDatastore }, key: string) => {
        const ds_config = (this.datastores || {})[key];
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
    return this.notifications || {};
  }

  getSubscriptions(): ServiceEventSubscriptions {
    return Object.keys(this.subscriptions || {})
      .reduce((res: ServiceEventSubscriptions, service_name: string) => {
        const events = (this.subscriptions || {})[service_name];
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
    if (this.debug instanceof ServiceDebugOptionsV1) {
      return this.debug;
    } else if (this.debug) {
      return {
        command: this.debug,
      };
    }

    return undefined;
  }

  setDebugOptions(debug?: ServiceDebugOptions) {
    if (!this.debug) {
      delete this.debug;
    } else {
      this.debug = plainToClass(ServiceDebugOptionsV1, debug);
    }
  }

  getLanguage(): string {
    if (!this.language) {
      throw new Error(`Missing language for service, ${this.name}`);
    }

    return this.language;
  }

  getPlatforms(): Dictionary<any> {
    return this.platforms || {};
  }

  getPort(): number | undefined {
    return this.port ? Number(this.port) : undefined;
  }

  getVolumes(): { [s: string]: VolumeSpec } {
    return Object.entries(this.volumes || {}).reduce((volumes, [key, entry]) => {
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
    return this.replicas || 1;
  }
}
