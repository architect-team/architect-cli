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

export interface InterfaceSpec {
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
  abstract __version?: string;
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract setImage(image: string): void;
  abstract getCommand(): string[];
  abstract getEntrypoint(): string[];
  abstract getEnvironmentVariables(): Dictionary<string>;
  abstract setEnvironmentVariable(key: string, value: string): void;
  abstract getInterfaces(): { [s: string]: InterfaceSpec };
  abstract setInterface(key: string, value: InterfaceSpec | string): void;
  abstract getDebugOptions(): ServiceConfig | undefined;
  abstract setDebugOptions(value: ServiceConfig): void;
  abstract getPlatforms(): { [s: string]: any };
  abstract getVolumes(): { [s: string]: VolumeSpec };
  abstract setVolume(key: string, value: VolumeSpec | string): void;
  abstract getReplicas(): string;
  abstract getLivenessProbe(): ServiceLivenessProbe | undefined;
  abstract getBuild(): BuildSpec;

  copy() {
    return classToClass(this);
  }

  expand() {
    const config = this.copy();

    const debug = config.getDebugOptions();
    if (debug) {
      config.setDebugOptions(debug.expand());
    }
    for (const [key, value] of Object.entries(this.getInterfaces())) {
      config.setInterface(key, value);
    }
    for (const [key, value] of Object.entries(this.getVolumes())) {
      config.setVolume(key, value);
    }
    return config;
  }

  merge(other_config: ServiceConfig): ServiceConfig {
    return plainToClassFromExist(this.expand(), other_config.expand());
  }
}
