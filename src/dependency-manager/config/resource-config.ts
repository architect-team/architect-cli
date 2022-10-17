import { ComponentInstanceMetadata } from '../spec/component-spec';
import { Dictionary } from '../utils/dictionary';

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
  build?: BuildConfig;
  cpu?: number | string; // TODO:290:number
  memory?: string;
  depends_on: string[];
  labels: Map<string, string>;
  reserved_name?: string;
}
