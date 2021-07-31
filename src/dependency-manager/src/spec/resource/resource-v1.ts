import { Type } from 'class-transformer';
import { Allow, IsEmpty, IsInstance, IsObject, IsOptional, IsString, Matches, ValidatorOptions } from 'class-validator';
import { parse as shell_parse } from 'shell-quote';
import { Dictionary } from '../../utils/dictionary';
import { ServiceVersionSlugUtils, Slugs } from '../../utils/slugs';
import { validateDictionary, validateNested } from '../../utils/validation';
import { MatchesKeys } from '../../utils/validators/matches-keys';
import { MatchesValues } from '../../utils/validators/matches-values';
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

  @IsOptional({ always: true })
  @IsString({ always: true, each: true })
  depends_on?: string[];

  @IsOptional({ always: true })
  @IsObject({ always: true })
  @MatchesKeys(Slugs.LabelKeySlugValidator, { always: true, message: `prefix must be lowercase and is optional, each <prefix>/<key> ${Slugs.LabelSlugDescription}` })
  @MatchesValues(Slugs.LabelValueSlugValidator, { always: true, message: `each value ${Slugs.LabelSlugDescription}` })
  labels?: Map<string, string>;

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
    errors = await validateDictionary(expanded, 'volumes', errors, undefined, volumes_options, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
    errors = await validateDictionary(expanded, 'interfaces', errors, undefined, options, new RegExp(`^${Slugs.ArchitectSlugRegexNoMaxLength}$`));
    return errors;
  }

  getRef(): string {
    return this.name || '';
  }

  getName(): string {
    const split = ServiceVersionSlugUtils.parse(this.name || '');
    return split.service_name;
  }

  getTag(): string {
    const split = ServiceVersionSlugUtils.parse(this.name || '');
    return split.tag;
  }

  getImage(): string {
    return this.image || '';
  }

  setImage(image: string) {
    this.image = image;
  }

  getCommand() {
    if (!this.command) return [];
    if (this.command instanceof Array) {
      return this.command;
    }
    const env: Dictionary<string> = {};
    for (const key of Object.keys(this.getEnvironmentVariables())) {
      env[key] = `$${key}`;
    }
    return shell_parse(this.command, env).map(e => `${e}`);
  }

  getEntrypoint() {
    if (!this.entrypoint) return [];
    if (this.entrypoint instanceof Array) {
      return this.entrypoint;
    }
    const env: Dictionary<string> = {};
    for (const key of Object.keys(this.getEnvironmentVariables())) {
      env[key] = `$${key}`;
    }
    return shell_parse(this.entrypoint, env).map(e => `${e}`);
  }

  getEnvironmentVariables(): Dictionary<string> {
    const output: Dictionary<string> = {};
    for (const [k, v] of Object.entries(this.environment || {})) {
      if (v === null) { continue; }
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

  getDependsOn(): string[] {
    return this.depends_on || [];
  }

  setLabels(labels: Map<string, string>) {
    this.labels = labels;
  }

  getLabels(): Map<string, string> {
    return this.labels || new Map();
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
