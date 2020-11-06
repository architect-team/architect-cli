import { Type } from 'class-transformer/decorators';
import { Allow, IsEmpty, IsInstance, IsObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { Dictionary } from '../../utils/dictionary';
import { validateDictionary, validateNested } from '../../utils/validation';
import { BaseConfig } from '../base-spec';
import { BuildSpecV1 } from '../common/build-v1';
import { DeploySpecV1 } from '../common/deploy-v1';
import { transformVolumes } from '../common/volume-transformer';
import { VolumeSpecV1 } from '../common/volume-v1';
import { ResourceConfig } from './resource-config';

export class ResourceConfigV1 extends BaseConfig implements ResourceConfig {
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

  @Type(() => ResourceConfigV1)
  @IsOptional({ always: true })
  @IsInstance(ResourceConfigV1, { always: true })
  @IsEmpty({ groups: ['debug'] })
  debug?: ResourceConfigV1;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  environment?: Dictionary<string>;

  @IsOptional({ always: true })
  platforms?: Dictionary<any>;

  @IsOptional({ always: true })
  @IsObject({ always: true })
  volumes?: Dictionary<VolumeSpecV1 | string>;

  @IsOptional({ always: true })
  @Type(() => BuildSpecV1)
  build?: BuildSpecV1;

  @IsOptional({ always: true })
  @Type(() => String)
  cpu?: string;

  @IsOptional({ always: true })
  @Type(() => String)
  memory?: string;

  @IsOptional({ always: true })
  deploy?: DeploySpecV1;

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

  getDebugOptions(): ResourceConfigV1 | undefined {
    return this.debug;
  }

  setDebugOptions(value: ResourceConfigV1) {
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

  getVolumes(): Dictionary<VolumeSpecV1> {
    return transformVolumes(this.volumes) || {};
  }

  setVolumes(value: Dictionary<VolumeSpecV1 | string>) {
    this.volumes = value;
  }

  setVolume(key: string, value: VolumeSpecV1 | string) {
    if (!this.volumes) {
      this.volumes = {};
    }
    this.volumes[key] = value;
  }

  getBuild() {
    if (!this.build && !this.image) {
      this.build = new BuildSpecV1();
      this.build.context = '.';
    }
    return this.build || {};
  }

  getCpu() {
    return this.cpu;
  }

  getMemory() {
    return this.memory;
  }

  getDeploy(): DeploySpecV1 | undefined {
    return this.deploy;
  }

  /** @return New expanded copy of the current config */
  expand() {
    const config = this.copy();

    const debug = config.getDebugOptions();
    if (debug) {
      config.setDebugOptions(debug.expand());
    }
    for (const [key, value] of Object.entries(this.getVolumes())) {
      config.setVolume(key, value);
    }
    return config;
  }
}
