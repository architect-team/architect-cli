import { TaskConfig } from '../../config/task-config';
import { TaskSpec } from '../task-spec';
import { transformResourceSpec } from './resource-transform';

export const transformTaskSpec = (key: string, spec: TaskSpec): TaskConfig => {
  const resource_config = transformResourceSpec(key, spec);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpec(key, spec.debug) : undefined,
    schedule: spec.schedule,
  };
};
