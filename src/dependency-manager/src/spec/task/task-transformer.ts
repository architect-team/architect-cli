import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { TaskConfigV1 } from './task-v1';

export function transformTasks(input?: Dictionary<object | TaskConfigV1>): Dictionary<TaskConfigV1> {
  if (!input) {
    return {};
  }

  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    let config;
    if (value instanceof TaskConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: key };
    } else {
      config = { name: key };
    }
    output[key] = plainToClass(TaskConfigV1, config);
  }

  return output;
}
