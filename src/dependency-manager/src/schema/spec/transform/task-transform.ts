import { TaskConfig } from '../../config/task-config';
import { TaskSpec } from '../task-spec';
import { transformResourceSpec } from './resource-transform';

export const transformTaskSpec = (key: string, spec: TaskSpec, tag: string): TaskConfig => {
  const resource_config = transformResourceSpec(key, spec, tag);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpec(key, spec.debug, tag) : undefined,
    schedule: spec.schedule,
  };
};
