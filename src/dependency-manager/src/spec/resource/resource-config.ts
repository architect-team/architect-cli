import { Dictionary } from '../../utils/dictionary';
import { ConfigSpec } from '../base-spec';
import { BuildSpec } from '../common/build-spec';
import { DeploySpec } from '../common/deploy-spec';
import { VolumeSpec } from '../common/volume-spec';

export interface ResourceConfig extends ConfigSpec {
  __version?: string;
  getRef(): string;
  getName(): string;
  getTag(): string;

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

  getDependsOn(): string[];

  setLabels(labels: Map<string, string>): void;
  getLabels(): Map<string, string>;
}
