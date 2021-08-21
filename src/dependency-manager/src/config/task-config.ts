import { ResourceConfig } from './resource-config';

export interface TaskConfig extends ResourceConfig {
  debug?: TaskConfig;
  schedule?: string;
}
