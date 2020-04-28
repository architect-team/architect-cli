import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { IsBoolean, IsEmpty, IsIn, IsInstance, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, ValidateIf, ValidatorOptions } from 'class-validator';
import { ParameterValue } from '../manager';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { Dict } from '../utils/transform';
import { validateDictionary, validateNested } from '../utils/validation';
import { ServiceApiSpec, ServiceConfig, ServiceDatastore, ServiceDebugOptions, ServiceEventNotifications, ServiceEventSubscriptions, ServiceInterfaceSpec, ServiceParameter, VolumeSpec } from './base';

const transformParameters = (input?: Dictionary<any>): Dictionary<ServiceParameterV1> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ServiceParameterV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object && !value.valueFrom) {
      output[key] = plainToClass(ServiceParameterV1, value);
    } else {
      output[key] = plainToClass(ServiceParameterV1, { default: value });
    }
  }
  return output;
};

const transformVolumes = (input?: Dictionary<string | Dictionary<any>>): Dictionary<ServiceVolumeV1> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ServiceVolumeV1> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(ServiceVolumeV1, value)
      : plainToClass(ServiceVolumeV1, { host_path: value });
  }
  return output;
};

const transformInterfaces = (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = typeof value === 'object'
      ? plainToClass(InterfaceSpecV1, value)
      : plainToClass(InterfaceSpecV1, { port: value });
  }
  return output;
};

class NotificationSpecV1 extends BaseSpec {
  @IsString()
  description!: string;
}

class RestSubscriptionDataV1 extends BaseSpec {
  @IsString()
  uri!: string;

  @IsOptional()
  headers?: Dictionary<string>;
}

class SubscriptionSpecV1 extends BaseSpec {
  @IsString()
  @IsIn(['rest', 'grpc'])
  type!: string;

  @Type(() => RestSubscriptionDataV1)
  @ValidateIf(obj => obj.type === 'rest')
  @IsInstance(RestSubscriptionDataV1)
  data?: RestSubscriptionDataV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'data', errors, options);
    return errors;
  }
}

class ServiceDatastoreV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  host?: string;

  @IsOptional()
  @IsNumber()
  port?: number;

  @IsOptional()
  @IsString()
  image?: string;

  @Transform(value => (transformParameters(value)))
  @IsOptional()
  parameters?: Dictionary<ServiceParameterV1>;
}

class ServiceParameterV1 extends BaseSpec {
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

class LivenessProbeV1 extends BaseSpec {
  @IsOptional()
  @IsNumber()
  success_threshold?: number;

  @IsOptional()
  @IsNumber()
  failure_threshold?: number;

  @IsOptional()
  @IsString()
  timeout?: string;

  @IsOptional()
  @IsString()
  path?: string;

  @IsOptional()
  @IsString()
  interval?: string;
}

class ApiSpecV1 extends BaseSpec {
  @IsString()
  @IsIn(['rest', 'grpc'])
  type = 'rest';

  @IsOptional()
  @IsString({ each: true })
  definitions?: string[];

  @Type(() => LivenessProbeV1)
  liveness_probe?: LivenessProbeV1;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'liveness_probe', errors, options);
    return errors;
  }
}

class InterfaceSpecV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode interface hosts when publishing services',
  })
  @IsString()
  host?: string;

  @IsNumber()
  port!: number;
}

export class ServiceVolumeV1 extends BaseSpec {
  @IsOptional()
  @IsString()
  mount_path?: string;

  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a host mount path when registering a service',
  })
  @IsNotEmpty({
    groups: ['debug'],
    message: 'Debug volumes require a host path to mount the volume to',
  })
  @IsString()
  host_path?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  readonly?: boolean;
}

class ServiceDebugOptionsV1 extends BaseSpec {
  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a filesystem location when registering a service',
  })
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

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'volumes', errors, undefined, {
      ...options,
      groups: ['debug'],
    });
    return errors;
  }
}

class IngressSpecV1 extends BaseSpec {
  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a subdomain when registering services',
  })
  subdomain?: string;
}

export class ServiceConfigV1 extends ServiceConfig {
  __version = '1.0.0';

  @IsOptional({
    groups: ['operator'],
  })
  @IsString()
  @Matches(/[a-zA-Z0-9-_]+/, {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(/^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+/, {
    message: 'Names must be prefixed with an account name (e.g. architect/service-name)',
  })
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
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
  @IsString()
  dockerfile?: string;

  @IsOptional()
  dependencies?: { [s: string]: string };

  @IsOptional()
  @IsString()
  language?: string;

  @Transform(value => (value instanceof Object
    ? plainToClass(ServiceDebugOptionsV1, value)
    : (value ? plainToClass(ServiceDebugOptionsV1, { command: value }) : value)),
  { toClassOnly: true })
  @IsOptional()
  @IsInstance(ServiceDebugOptionsV1)
  debug?: ServiceDebugOptionsV1;

  @Transform(value => (transformParameters(value)))
  @IsOptional()
  parameters?: { [s: string]: ServiceParameterV1 };

  @Transform(Dict(() => ServiceDatastoreV1), { toClassOnly: true })
  @IsOptional()
  datastores?: Dictionary<ServiceDatastoreV1>;

  @Type(() => ApiSpecV1)
  @IsOptional()
  @IsInstance(ApiSpecV1)
  api?: ApiSpecV1;

  @Transform(value => (transformInterfaces(value)))
  @IsOptional()
  interfaces?: Dictionary<InterfaceSpecV1>;

  @Transform(Dict(() => NotificationSpecV1), { toClassOnly: true })
  @IsOptional()
  notifications?: Dictionary<NotificationSpecV1>;

  @Transform((subscriptions: Dictionary<Dictionary<any>> | undefined) => {
    if (!subscriptions) {
      return undefined;
    }

    const res = {} as Dictionary<Dictionary<SubscriptionSpecV1>>;
    for (const [service_name, events] of Object.entries(subscriptions)) {
      res[service_name] = {};
      for (const [event_name, data] of Object.entries(events)) {
        res[service_name][event_name] = plainToClass(SubscriptionSpecV1, data);
      }
    }
    return res;
  }, { toClassOnly: true })
  @IsOptional()
  subscriptions?: Dictionary<Dictionary<SubscriptionSpecV1>>;

  @IsOptional()
  platforms?: Dictionary<any>;

  @Transform(value => (transformVolumes(value)))
  @IsOptional()
  volumes?: Dictionary<ServiceVolumeV1>;

  @Type(() => IngressSpecV1)
  @IsOptional()
  @IsInstance(IngressSpecV1)
  ingress?: IngressSpecV1;

  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a replica count when registering services',
  })
  @IsNumber()
  replicas?: number;

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

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateNested(this, 'debug', errors, options);
    errors = await validateNested(this, 'ingress', errors, options);
    errors = await validateDictionary(this, 'volumes', errors, undefined, options);
    return errors;
  }

  getName(): string {
    return this.name || '';
  }

  getApiSpec(): ServiceApiSpec {
    const spec = (this.api || { type: 'rest' }) as ServiceApiSpec;
    spec.liveness_probe = {
      path: '/',
      success_threshold: 1,
      failure_threshold: 1,
      timeout: '5s',
      interval: '30s',
      ...(spec.liveness_probe || {}),
    };
    return spec;
  }

  getInterfaces(): Dictionary<ServiceInterfaceSpec> {
    return this.interfaces || {};
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

  getDatastores(): Dictionary<ServiceDatastore> {
    const datastores = this.datastores || {};
    return Object.keys(datastores)
      .reduce((res: { [s: string]: ServiceDatastore }, key: string) => {
        const ds_config = datastores[key];
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
    const subscriptions = this.subscriptions || {};
    return Object.keys(subscriptions)
      .reduce((res: ServiceEventSubscriptions, service_name: string) => {
        const events = subscriptions[service_name];
        Object.entries(events).forEach(([event_name, event_config]) => {
          res[service_name] = res[service_name] || {};
          res[service_name][event_name] = {
            type: event_config.type,
            data: {
              uri: event_config.data?.uri || '',
              headers: event_config.data?.headers,
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
    if (this.ingress) {
      return {
        subdomain: '',
        ...this.ingress,
      };
    }

    return undefined;
  }

  getReplicas() {
    return this.replicas || 1;
  }
}
