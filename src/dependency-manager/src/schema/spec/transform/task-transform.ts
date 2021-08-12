import { TaskConfig } from '../../config/task-config';
import { TaskSpec } from '../task-spec';
import { transformResourceSpec } from './resource-transform';

export const transformTaskSpec = (key: string, spec: TaskSpec, component_ref: string, tag: string): TaskConfig => {
  const resource_config = transformResourceSpec(key, spec, component_ref, tag);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpec(key, spec.debug, component_ref, tag) : undefined,
    schedule: spec.schedule,
  };
};
