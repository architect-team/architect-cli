import { Dictionary } from '../../utils/dictionary';

export interface DeployModuleConfig {
  path: string;
  inputs: Dictionary<string>;
}

export interface DeployConfig {
  strategy: string;
  modules: Dictionary<DeployModuleConfig>;
}

export interface VolumeConfig {
  mount_path?: string;
  host_path?: string;
  key?: string;
  description?: string;
  readonly?: boolean;
}

export interface BuildConfig {
  context?: string;
  args: Dictionary<string>;
  dockerfile?: string;
}

export interface ResourceConfig {
  name: string;
  description?: string;
  image?: string;
  command?: string[];
  entrypoint?: string[];
  language: string;
  debug?: ResourceConfig;
  environment: Dictionary<string>;
  platforms: Dictionary<any>;
  volumes: Dictionary<VolumeConfig>;
  build?: BuildConfig;
  cpu?: string;
  memory?: string;
  deploy?: DeployConfig;
  depends_on: string[];
  labels: Map<string, string>;
}
