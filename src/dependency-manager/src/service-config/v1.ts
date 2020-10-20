import { plainToClass } from 'class-transformer';
import { Transform, Type } from 'class-transformer/decorators';
import { Allow, IsBoolean, IsEmpty, IsInstance, IsNotEmpty, IsObject, IsOptional, IsString, Matches, ValidateIf, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { ParameterDefinitionSpecV1 } from '../component-config/v1';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';
import { validateDictionary, validateNested } from '../utils/validation';
import { Exclusive } from '../utils/validators/exclusive';
import { ServiceConfig, ServiceLivenessProbe, VolumeSpec } from './base';

class LivenessProbeV1 extends BaseSpec {
  @IsOptional({ always: true })
  @Type(() => String)
  success_threshold?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  failure_threshold?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  timeout?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  interval?: string;

  @IsOptional({ always: true })
  @IsString({ always: true })
  initial_delay?: string;

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Path with port and command are exclusive' })
  @IsString({ always: true })
  path?: string;

  @ValidateIf(obj => !obj.path || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['path', 'port'], { always: true, message: 'Command and path with port are exclusive' })
  @IsString({ always: true, each: true })
  command?: string[] | string;

  @ValidateIf(obj => !obj.command || ((obj.path || obj.port) && obj.command), { always: true })
  @Exclusive(['command'], { always: true, message: 'Command and path with port are exclusive' })
  @IsNotEmpty({ always: true })
  @Type(() => String)
  port?: string;
}

export class InterfaceSpecV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsString({ always: true })
  description?: string;

  @IsOptional({ always: true })
  /* TODO: Figure out if we should share the interface spec
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode interface hosts when publishing services',
  })
  */
  @IsString({ always: true })
  host?: string;

  @ValidateIf(obj => obj.host, { groups: ['operator'] })
  @IsNotEmpty({ always: true })
  @Type(() => String)
  port!: string;

  @IsOptional({ always: true })
  protocol?: string;

  @IsOptional({ always: true })
  url?: string;
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
    message: 'Cannot hardcode a host mount path in a component outside of the debug block',
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

export class BuildSpecV1 extends BaseSpec {
  @IsOptional({ always: true })
  @IsString({ always: true })
  context?: string;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @Transform(value => {
    if (value) {
      if (!(value instanceof Object)) {
        return value;
      }
      const output: Dictionary<string> = {};
      for (const [k, v] of Object.entries(value)) {
        output[k] = `${v}`;
      }
      return output;
    }
  })
  args?: Dictionary<string>;

  @IsOptional({ always: true })
  @IsString({ always: true })
  dockerfile?: string;
}

export const transformParameters = (input?: Dictionary<any>): Dictionary<ParameterDefinitionSpecV1> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<ParameterDefinitionSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === 'object') {
      output[key] = plainToClass(ParameterDefinitionSpecV1, value);
    } else {
      output[key] = plainToClass(ParameterDefinitionSpecV1, {
        default: value,
      });
    }
  }
  return output;
};

const transformVolumes = (input?: Dictionary<string | Dictionary<any>>): Dictionary<ServiceVolumeV1> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<ServiceVolumeV1> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(ServiceVolumeV1, value)
      : plainToClass(ServiceVolumeV1, { host_path: value });
  }
  return output;
};

export const transformInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(InterfaceSpecV1, value)
      : plainToClass(InterfaceSpecV1, { port: value });
  }
  return output;
};

export class ServiceConfigV1 extends ServiceConfig {
  @Allow({ always: true })
  __version?: string;

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
  @IsString({ always: true, each: true })
  command?: string | string[];

  @IsOptional({ always: true })
  @IsString({ always: true, each: true })
  entrypoint?: string | string[];

  @IsOptional({ always: true })
  @IsString({ always: true })
  language?: string;

  @Type(() => ServiceConfigV1)
  @IsOptional({ always: true })
  @IsInstance(ServiceConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: ServiceConfigV1;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  environment?: Dictionary<string>;

  @IsOptional({ groups: ['operator', 'debug'] })
  @IsObject({ groups: ['developer'], message: 'interfaces must be defined even if it is empty since the majority of services need to expose ports' })
  @Transform((value) => !value ? {} : value)
  interfaces?: Dictionary<InterfaceSpecV1 | string>;

  @Type(() => LivenessProbeV1)
  @IsOptional({ always: true })
  @IsInstance(LivenessProbeV1, { always: true })
  liveness_probe?: LivenessProbeV1;

  @IsOptional({ always: true })
  platforms?: Dictionary<any>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  volumes?: Dictionary<ServiceVolumeV1 | string>;

  @IsOptional({ always: true })
  @IsEmpty({
    groups: ['developer'],
    message: 'Cannot hardcode a replica count when registering services',
  })
  @Type(() => String)
  replicas?: string;

  @IsOptional({ always: true })
  @Type(() => BuildSpecV1)
  build?: BuildSpecV1;

  async validate(options?: ValidatorOptions) {
    if (!options) { options = {}; }
    let errors = await super.validate(options);
    if (errors.length) return errors;
    const expanded = this.expand();
    errors = await validateNested(expanded, 'debug', errors, { ...options, groups: (options.groups || []).concat('debug') });
    errors = await validateNested(expanded, 'liveness_probe', errors, options);
    // Hack to overcome conflicting IsEmpty vs IsNotEmpty with developer vs debug
    const volumes_options = { ...options };
    if (volumes_options.groups && volumes_options.groups.includes('debug')) {
      volumes_options.groups = ['debug'];
    }
    errors = await validateDictionary(expanded, 'environment', errors, undefined, options, /^[a-zA-Z0-9_]+$/);
    errors = await validateDictionary(expanded, 'volumes', errors, undefined, volumes_options);
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options);
    return errors;
  }

  getName(): string {
    return this.name || '';
  }

  getInterfaces() {
    return transformInterfaces(this.interfaces) || {};
  }

  setInterfaces(value: Dictionary<InterfaceSpecV1 | string>) {
    this.interfaces = value;
  }

  setInterface(key: string, value: InterfaceSpecV1 | string) {
    if (!this.interfaces) {
      this.interfaces = {};
    }
    this.interfaces[key] = value;
  }

  getLivenessProbe(): ServiceLivenessProbe | undefined {
    if (!this.liveness_probe || !Object.keys(this.liveness_probe).length) { return undefined; }

    const liveness_probe = {
      success_threshold: '1',
      failure_threshold: '1',
      timeout: '5s',
      interval: '30s',
      initial_delay: '0s',
      ...this.liveness_probe,
    };

    if (this.liveness_probe.command && typeof this.liveness_probe.command === 'string') {
      liveness_probe.command = shell_parse(this.liveness_probe.command).map(e => `${e}`);
    }

    return liveness_probe as ServiceLivenessProbe;
  }

  getImage(): string {
    return this.image || '';
  }

  setImage(image: string) {
    this.image = image;
  }

  getCommand() {
    if (!this.command) return [];
    return this.command instanceof Array ? this.command : shell_parse(this.command).map(e => `${e}`);
  }

  getEntrypoint() {
    if (!this.entrypoint) return [];
    return this.entrypoint instanceof Array ? this.entrypoint : shell_parse(this.entrypoint).map(e => `${e}`);
  }

  getEnvironmentVariables(): Dictionary<string> {
    const output: Dictionary<string> = {};
    for (const [k, v] of Object.entries(this.environment || {})) {
      output[k] = `${v}`;
    }
    return output;
  }

  setEnvironmentVariables(value: Dictionary<string>) {
    this.environment = value;
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

  setDebugOptions(value: ServiceConfigV1) {
    this.debug = value;
  }

  getLanguage(): string {
    if (!this.language) {
      throw new Error(`Missing language for service, ${this.name}`);
    }

    return this.language;
  }

  getDescription() {
    return this.description || '';
  }

  getPlatforms(): Dictionary<any> {
    return this.platforms || {};
  }

  getVolumes(): Dictionary<VolumeSpec> {
    return transformVolumes(this.volumes) || {};
  }

  setVolumes(value: Dictionary<ServiceVolumeV1 | string>) {
    this.volumes = value;
  }

  setVolume(key: string, value: ServiceVolumeV1 | string) {
    if (!this.volumes) {
      this.volumes = {};
    }
    this.volumes[key] = value;
  }

  getReplicas() {
    return this.replicas || '1';
  }

  getBuild() {
    if (!this.build && !this.image) {
      this.build = new BuildSpecV1();
      this.build.context = '.';
    }
    return this.build || {};
  }
}
