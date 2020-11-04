import { ConfigSpec } from '../utils/base-spec';
import { Dictionary } from '../utils/dictionary';

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

export interface DeployModuleSpec {
  path: string;
  inputs: Dictionary<string>;
}

export interface DeploySpec {
  strategy: string;
  modules: Dictionary<DeployModuleSpec>;
}

export interface ResourceConfig extends ConfigSpec {
  __version?: string;
  getName(): string;
  getDescription(): string;
  getLanguage(): string;
  getImage(): string;
  setImage(image: string): void;
  getCommand(): string[];
  getEntrypoint(): string[];

  getEnvironmentVariables(): Dictionary<string>;
  setEnvironmentVariables(value: Dictionary<string>): void;
  setEnvironmentVariable(key: string, value: string): void;

  getDebugOptions(): ResourceConfig | undefined;
  setDebugOptions(value: ResourceConfig): void;

  getPlatforms(): Dictionary<any>;

  getVolumes(): Dictionary<VolumeSpec>;
  setVolumes(value: Dictionary<VolumeSpec | string>): void;
  setVolume(key: string, value: VolumeSpec | string): void;

  getBuild(): BuildSpec;

  getCpu(): string | undefined;
  getMemory(): string | undefined;

  getDeploy(): DeploySpec | undefined;
}
