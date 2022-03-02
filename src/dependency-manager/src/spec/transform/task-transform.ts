import { TaskConfig } from '../../config/task-config';
import { ComponentInstanceMetadata } from '../component-spec';
import { TaskSpec } from '../task-spec';
import { transformResourceSpec } from './resource-transform';

export const transformTaskSpec = (key: string, spec: TaskSpec, metadata: ComponentInstanceMetadata): TaskConfig => {
  const resource_config = transformResourceSpec('tasks', key, spec, metadata);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpec(key, spec.debug, metadata) : undefined,
    schedule: spec.schedule,
  };
};
