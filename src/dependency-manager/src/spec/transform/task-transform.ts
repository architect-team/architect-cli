import { ComponentInstanceMetadata } from '../../config/component-config';
import { TaskConfig } from '../../config/task-config';
import { TaskSpec } from '../task-spec';
import { transformResourceSpec } from './resource-transform';

export const transformTaskSpec = (key: string, spec: TaskSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): TaskConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag, instance_metadata);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpec(key, spec.debug, component_ref, tag, instance_metadata) : undefined,
    schedule: spec.schedule,
  };
};
