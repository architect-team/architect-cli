import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { ComponentVersionSlugUtils, ServiceVersionSlugUtils } from '../../utils/slugs';
import { ServiceConfigV1 } from './service-v1';

export function transformServices(input: Dictionary<object | ServiceConfigV1>, component_ref: string): Dictionary<ServiceConfigV1> {
  if (!(input instanceof Object)) {
    return input;
  }

  const parsed = ComponentVersionSlugUtils.parse(component_ref);

  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    const service_ref = ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, key, parsed.tag);
    let config;
    if (value instanceof ServiceConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: service_ref };
    } else {
      config = { name: service_ref };
    }
    output[key] = plainToClass(ServiceConfigV1, config);
  }

  return output;
}
