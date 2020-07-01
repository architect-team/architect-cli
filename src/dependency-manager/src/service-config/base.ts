import { classToClass, plainToClassFromExist } from 'class-transformer';
import { BaseSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export interface VaultParameter {
  vault: string;
  key: string;
}

export type ParameterValue = string | number | boolean | undefined;

export interface ServiceParameter {
  description: string;
  default?: ParameterValue;
  required: boolean;
}

export interface ServiceInterfaceSpec {
  description?: string;
  host?: string;
  port: string;
  url?: string;
  protocol?: string;
}

export interface ServiceLivenessProbe {
  success_threshold?: string;
  failure_threshold?: string;
  timeout?: string;
  path?: string;
  interval?: string;
  command?: string[];
  port?: string;
}

export interface VolumeSpec {
  mount_path?: string;
  host_path?: string;
  description?: string;
  readonly?: boolean;
}

export interface BuildSpec {
  context?: string;
  args?: Dictionary<string>;
  dockerfile?: string;
}

export abstract class ServiceConfig extends BaseSpec {
  abstract __version: string;
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract setImage(image: string): void;
  abstract getDigest(): string;
  abstract setDigest(digest: string): void;
  abstract getCommand(): string[];
  abstract getEntrypoint(): string[];
  abstract getEnvironmentVariables(): Dictionary<string>;
  abstract setEnvironmentVariable(key: string, value: string): void;
  abstract getInterfaces(): { [s: string]: ServiceInterfaceSpec };
  abstract getDebugOptions(): ServiceConfig | undefined;
  abstract getPlatforms(): { [s: string]: any };
  abstract getVolumes(): { [s: string]: VolumeSpec };
  abstract getReplicas(): string;
  abstract getLivenessProbe(): ServiceLivenessProbe | undefined;
  abstract getBuild(): BuildSpec;

  copy() {
    return classToClass(this);
  }

  merge(other_config: ServiceConfig): ServiceConfig {
    return plainToClassFromExist(this.copy(), other_config);
  }
}
