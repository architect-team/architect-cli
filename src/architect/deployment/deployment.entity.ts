import Pipeline from '../pipeline/pipeline.entity';

export default interface Deployment {
  id: string;
  instance_id: string;
  applied_at?: string;
  failed_at?: string;
  aborted_at?: string;
  type: string;
  component_version: {
    tag: string;
    config: {
      name: string;
    };
  };
  pipeline: Pipeline;
}
