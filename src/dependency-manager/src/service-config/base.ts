import { ConfigSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

export interface InterfaceSpec {
  description?: string;
  host?: string;
  port: string;
  url?: string;
  protocol?: string;
  domains?: string[];
}

export interface ServiceLivenessProbe {
  success_threshold?: string;
  failure_threshold?: string;
  timeout?: string;
  path?: string;
  interval?: string;
  command?: string[];
  port?: string;
  initial_delay?: string;
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

export abstract class ServiceConfig extends ConfigSpec {
  abstract __version?: string;
  abstract getName(): string;
  abstract getDescription(): string;
  abstract getLanguage(): string;
  abstract getImage(): string;
  abstract setImage(image: string): void;
  abstract getCommand(): string[];
  abstract getEntrypoint(): string[];

  abstract getEnvironmentVariables(): Dictionary<string>;
  abstract setEnvironmentVariables(value: Dictionary<string>): void;
  abstract setEnvironmentVariable(key: string, value: string): void;

  abstract getInterfaces(): Dictionary<InterfaceSpec>;
  abstract setInterfaces(value: Dictionary<InterfaceSpec | string>): void;
  abstract setInterface(key: string, value: InterfaceSpec | string): void;

  abstract getDebugOptions(): ServiceConfig | undefined;
  abstract setDebugOptions(value: ServiceConfig): void;

  abstract getPlatforms(): Dictionary<any>;

  abstract getVolumes(): Dictionary<VolumeSpec>;
  abstract setVolumes(value: Dictionary<VolumeSpec | string>): void;
  abstract setVolume(key: string, value: VolumeSpec | string): void;

  abstract getReplicas(): string;
  abstract getLivenessProbe(): ServiceLivenessProbe | undefined;
  abstract getBuild(): BuildSpec;

  abstract getCpu(): string | undefined;
  abstract getMemory(): string | undefined;

  /** @return New expanded copy of the current config */
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
}
