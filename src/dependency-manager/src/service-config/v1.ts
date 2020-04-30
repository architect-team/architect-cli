import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { IsBoolean, IsEmpty, IsIn, IsInstance, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, ValidateIf, ValidatorOptions } from 'class-validator';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { Dict } from '../utils/transform';
import { validateDictionary, validateNested } from '../utils/validation';
import { ParameterDefinitionSpecV1 } from '../v1-spec/parameters';
import { ServiceApiSpec, ServiceConfig, ServiceDatastore, ServiceEventNotifications, ServiceEventSubscriptions, ServiceInterfaceSpec, ServiceParameter, VolumeSpec } from './base';

const transformParameters = (input?: Dictionary<any>): Dictionary<ParameterDefinitionSpecV1> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ParameterDefinitionSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'object') {
      if (value.value_from || value.valueFrom) {
        value.valueFrom = value.valueFrom || value.value_from;
        value.default = value.default || { valueFrom: value.valueFrom };
        delete value.valueFrom;
        delete value.value_from;
      }

      output[key] = plainToClass(ParameterDefinitionSpecV1, value);
    } else {
      output[key] = plainToClass(ParameterDefinitionSpecV1, {
        default: value,
      });
    }
  }
  return output;
};

export function transformServices(input: { [key: string]: string | ServiceConfigV1 }) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    const [name, ext] = key.split(':');
    let config;
    if (value instanceof Object) {
      if (ext && !value.extends) {
        value.extends = ext;
      }
      config = { private: !value.extends, ...value, name };
    } else {
      config = { extends: value, name };
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    output[key] = plainToClass(ServiceConfigV1, config);
  }
  return output;
}

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
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options);
    return errors;
  }
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

  @IsOptional()
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a filesystem location when registering a service',
  })
  @IsString()
  path?: string;

  @IsOptional({
    groups: ['debug', 'operator'],
  })
  @IsString()
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  @Matches(/^[a-zA-Z0-9-_]+\/[a-zA-Z0-9-_]+$/, {
    message: 'Names must be prefixed with an account name (e.g. architect/service-name)',
    groups: ['developer'],
  })
  name?: string;

  @IsOptional()
  @IsString()
  extends?: string;

  @IsOptional()
  @IsString()
  parent_ref?: string;

  @IsOptional()
  @IsBoolean()
  private?: boolean;

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
  digest?: string;

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
  @Transform(value => (transformServices(value)))
  dependencies?: Dictionary<ServiceConfigV1>;

  @IsOptional()
  @IsString()
  language?: string;

  @Transform(value => (value instanceof Object
    ? plainToClass(ServiceConfigV1, value)
    : (value ? plainToClass(ServiceConfigV1, { command: value }) : value)),
    { toClassOnly: true })
  @IsOptional()
  @IsInstance(ServiceConfigV1)
  debug?: ServiceConfigV1;

  @Transform(value => (transformParameters(value)))
  @IsOptional()
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

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

  private normalizeParameters(parameters: Dictionary<ParameterDefinitionSpecV1>): Dictionary<ServiceParameter> {
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
    errors = await validateNested(this, 'debug', errors, { ...options, groups: (options?.groups || []).concat('debug') });
    errors = await validateNested(this, 'ingress', errors, options);
    errors = await validateDictionary(this, 'volumes', errors, undefined, options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options);
    errors = await validateDictionary(this, 'datastores', errors, undefined, options);
    return errors;
  }

  getExtends() {
    if (this.extends) {
      return this.extends.includes(':') ? this.extends : `${this.getName()}:${this.extends}`;
    }
  }

  getRef() {
    const tag = this.extends && this.extends.includes(':') ? 'latest' : this.extends || 'latest';
    const ref = `${this.getName()}:${tag}`;
    return this.parent_ref ? `${this.parent_ref}.${ref}` : ref;
  }

  setParentRef(ref: string) {
    this.parent_ref = ref;
  }

  getParentRef() {
    return this.parent_ref;
  }

  getPrivate(): boolean {
    return this.private || false;
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

  setImage(image: string) {
    this.image = image;
  }

  getDigest(): string | undefined {
    return this.digest;
  }

  setDigest(digest: string) {
    this.digest = digest;
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

  getDependencies() {
    return this.dependencies || {};
  }

  addDependency(name: string, tag: string) {
    this.dependencies = this.getDependencies();
    this.dependencies[name] = new ServiceConfigV1();
    this.dependencies[name].name = name;
    this.dependencies[name].extends = tag;
  }

  removeDependency(dependency_name: string) {
    if (this.dependencies) {
      delete this.dependencies[dependency_name];
    }
  }

  getParameters(): Dictionary<ServiceParameter> {
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

  getDebugOptions(): ServiceConfig | undefined {
    return this.debug;
  }

  setDebugPath(debug_path: string) {
    if (!this.debug) {
      this.debug = new ServiceConfigV1();
    }
    this.debug.path = debug_path;
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
