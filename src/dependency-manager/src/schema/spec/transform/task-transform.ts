import { TaskConfig } from '../../config/task-config';
import { TaskSpecV1 } from '../task-spec';
import { transformResourceSpecV1 } from './resource-transform';

export const transformTaskSpecV1 = (key: string, spec: TaskSpecV1): TaskConfig => {
  const resource_config = transformResourceSpecV1(key, spec);

  return {
    ...resource_config,
    debug: spec.debug ? transformTaskSpecV1(key, spec.debug) : undefined,
    schedule: spec.schedule,
  };
};
