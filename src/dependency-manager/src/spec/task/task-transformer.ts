import { plainToClass } from 'class-transformer';
import { ComponentVersionSlugUtils, ServiceVersionSlugUtils } from '../..';
import { Dictionary } from '../../utils/dictionary';
import { TaskConfigV1 } from './task-v1';

export function transformTasks(input: Dictionary<object | TaskConfigV1>, component_ref: string): Dictionary<TaskConfigV1> {
  if (!input) {
    return {};
  }

  const parsed_component = ComponentVersionSlugUtils.parse(component_ref);

  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    const task_ref = ServiceVersionSlugUtils.build(parsed_component.component_account_name, parsed_component.component_name, key, parsed_component.tag, parsed_component.instance_name);
    let config;
    if (value instanceof TaskConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: task_ref };
    } else {
      config = { name: task_ref };
    }
    output[key] = plainToClass(TaskConfigV1, config);
  }

  return output;
}
