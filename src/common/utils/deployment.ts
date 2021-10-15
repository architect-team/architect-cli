import { Pipeline } from './pipeline';

export interface Deployment {
  id: string;
  instance_id: string;
  name: string;
  type: string;
  component_version: {
    tag: string;
    config: {
      name: string;
    };
  };
  pipeline: Pipeline
}
