import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { Allow, IsBoolean, IsEmpty, IsInstance, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, ValidateIf, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { Dict } from '../utils/transform';
import { validateDictionary, validateNested } from '../utils/validation';
import { Exclusive } from '../utils/validators/exclusive';
import { ParameterDefinitionSpecV1 } from '../v1-spec/parameters';
import { ServiceConfig, ServiceInterfaceSpec, ServiceLivenessProbe, VolumeSpec } from './base';

export const transformParameters = (input?: Dictionary<any>): Dictionary<ParameterDefinitionSpecV1> | undefined => {
  if (!input) {
    return undefined;
  }

  const output: Dictionary<ParameterDefinitionSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === 'object') {
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

export function transformServices(input: Dictionary<string | object | ServiceConfigV1>, parent?: any) {
  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    let config;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    if (value instanceof ServiceConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: key };
    } else {
      config = { name: key };
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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      ? plainToClass(ServiceVolumeV1, value)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
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
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      ? plainToClass(InterfaceSpecV1, value)
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      : plainToClass(InterfaceSpecV1, { port: value });
  }
  return output;
};

class ServiceDatastoreV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsString({ always: true })
  host?: string;

  @IsOptional({ always: true })
  @IsNumber(undefined, { always: true })
  port?: number;

  @IsOptional({ always: true })
  @IsString({ always: true })
  image?: string;

  @Transform(value => (transformParameters(value)))
  @IsOptional({ always: true })
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

  async validate(options?: ValidatorOptions) {
    let errors = await super.validate(options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options);
    return errors;
  }
}

class LivenessProbeV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsNumber(undefined, { always: true })
  success_threshold?: number;

  @IsOptional({ always: true })
  @IsNumber(undefined, { always: true })
  failure_threshold?: number;

  @IsOptional({ always: true })
  @IsString({ always: true })
  timeout?: string;

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Path with port and command are exclusive' })
  @IsString({ always: true })
  path?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  interval?: string;

  @Transform(value => value instanceof Array ? value : shell_parse(value))
  @ValidateIf(obj => !obj.path || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['path', 'port'], { always: true, message: 'Command and path with port are exclusive' })
  @IsString({ always: true, each: true })
  command?: string[];

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Command and path with port are exclusive' })
  @IsNumber(undefined, { always: true })
  port?: number;
}

class InterfaceSpecV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode interface hosts when publishing services',
  })
  @IsString({ always: true })
  host?: string;

  @ValidateIf(obj => obj.host, { groups: ['operator'] })
  @IsNumber(undefined, { always: true })
  port?: number;

  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a subdomain when registering services',
  })
  subdomain?: string;
}

export class ServiceVolumeV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsString({ always: true })
  mount_path?: string;

  @IsOptional({ groups: ['developer', 'operator'] })
  @IsNotEmpty({
    groups: ['debug'],
    message: 'Debug volumes require a host path to mount the volume to',
  })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a host mount path when registering a service',
  })
  @IsString({ always: true })
  host_path?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsBoolean({ always: true })
  readonly?: boolean;
}

export class ServiceConfigV1 extends ServiceConfig {
  @Allow({ always: true })
  __version = '1.0.0';

  @IsOptional({ always: true })
  @IsString({ always: true })
  @Matches(/^[a-zA-Z0-9-_]+$/, {
    message: 'Names must only include letters, numbers, dashes, and underscores',
  })
  name?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  image?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  digest?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  host?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  port?: string;

  @Transform(value => value instanceof Array ? value : shell_parse(value))
  @IsOptional({ always: true })
  @IsString({ always: true, each: true })
  command?: string[];

  @Transform(value => value instanceof Array ? value : shell_parse(value))
  @IsOptional({ always: true })
  @IsString({ always: true, each: true })
  entrypoint?: string[];

  @IsOptional({ always: true })
  @IsString({ always: true })
  dockerfile?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  language?: string;

  @IsOptional({ always: true })
  @IsString({ each: true, always: true })
  keywords?: string[];

  @IsOptional({ always: true })
  @IsString({ always: true })
  author?: string;

  @Transform(value => {
    if (value instanceof Array) {
      return plainToClass(ServiceConfigV1, { command: value });
    } if (typeof value === 'string') {
      return plainToClass(ServiceConfigV1, { command: shell_parse(value) });
    } else {
      return plainToClass(ServiceConfigV1, value);
    }
  }, { toClassOnly: true })
  @IsOptional({ always: true })
  @IsInstance(ServiceConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: ServiceConfigV1;

  @Transform(value => (transformParameters(value)))
  @IsEmpty({ groups: ['component'] })
  @IsOptional({ always: true })
  parameters?: Dictionary<ParameterDefinitionSpecV1>;

  @IsOptional({ always: true })
  @Transform(value => {
    if (value) {
      const output: Dictionary<string> = {};
      for (const [k, v] of Object.entries(value)) {
        output[k] = `${v}`;
      }
      return output;
    }
  })
  environment?: Dictionary<string>;

  @Transform(Dict(() => ServiceDatastoreV1), { toClassOnly: true })
  @IsOptional({ always: true })
  @IsEmpty({ groups: ['component'] })
  datastores?: Dictionary<ServiceDatastoreV1>;

  @Transform(value => (transformInterfaces(value)))
  @IsOptional({ always: true })
  interfaces?: Dictionary<InterfaceSpecV1>;

  @Type(() => LivenessProbeV1)
  @IsOptional({ always: true })
  @IsInstance(LivenessProbeV1, { always: true })
  liveness_probe?: LivenessProbeV1;

  @IsOptional({ always: true })
  platforms?: Dictionary<any>;

  @Transform(value => (transformVolumes(value)))
  @IsOptional({ always: true })
  volumes?: Dictionary<ServiceVolumeV1>;

  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a replica count when registering services',
  })
  @IsNumber(undefined, { always: true })
  replicas?: number;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    errors = await validateNested(this, 'debug', errors, { ...options, groups: (options.groups || []).concat('debug') });
    errors = await validateNested(this, 'liveness_probe', errors, options);
    // Hack to overcome conflicting IsEmpty vs IsNotEmpty with developer vs debug
    const volumes_options = { ...options };
    if (volumes_options.groups && volumes_options.groups.includes('debug')) {
      volumes_options.groups = ['debug'];
    }
    errors = await validateDictionary(this, 'volumes', errors, undefined, volumes_options);
    errors = await validateDictionary(this, 'parameters', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(this, 'datastores', errors, undefined, options);
    errors = await validateDictionary(this, 'interfaces', errors, undefined, options);
    return errors;
  }

  getName(): string {
    return this.name || '';
  }

  getInterfaces(): Dictionary<ServiceInterfaceSpec> {
    return this.interfaces || {};
  }

  getLivenessProbe(): ServiceLivenessProbe | undefined {
    if (!this.liveness_probe || !Object.keys(this.liveness_probe).length) { return undefined; }

    const liveness_probe = {
      success_threshold: 1,
      failure_threshold: 1,
      timeout: '5s',
      interval: '30s',
      ...this.liveness_probe,
    };

    return liveness_probe as ServiceLivenessProbe;
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
    return this.command || [];
  }

  getEntrypoint() {
    return this.entrypoint || [];
  }

  getDockerfile() {
    return this.dockerfile;
  }

  getEnvironmentVariables(): Dictionary<string> {
    return this.environment || {};
  }

  setEnvironmentVariable(key: string, value: string) {
    if (!this.environment) {
      this.environment = {};
    }
    this.environment[key] = value;
  }

  getDebugOptions(): ServiceConfig | undefined {
    return this.debug;
  }

  getLanguage(): string {
    if (!this.language) {
      throw new Error(`Missing language for service, ${this.name}`);
    }

    return this.language;
  }

  getKeywords() {
    return this.keywords || [];
  }

  getAuthor() {
    return this.author || '';
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

  getReplicas() {
    return this.replicas || 1;
  }
}
