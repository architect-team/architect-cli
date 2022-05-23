import { ComponentInstanceMetadata } from '../spec/component-spec';
import { Dictionary } from '../utils/dictionary';

export interface DeployModuleConfig {
  path: string;
  inputs: Dictionary<string | null>;
}

export interface DeployConfig {
  strategy: string;
  modules: Dictionary<DeployModuleConfig>;
}

export interface BuildConfig {
  context?: string;
  args?: Dictionary<string>;
  dockerfile?: string;
  target?: string;
}

export interface ResourceConfig {
  name: string;
  metadata: ComponentInstanceMetadata;
  description?: string;
  image?: string; // TODO:290: not optional
  command?: string[];
  entrypoint?: string[];
  language?: string;
  environment: Dictionary<string | null>; // TODO:290:Dictionary<string>
  build: BuildConfig;
  cpu?: number | string; // TODO:290:number
  memory?: string;
  deploy?: DeployConfig;
  depends_on: string[];
  labels: Map<string, string>;
  reserved_name?: string;
}
