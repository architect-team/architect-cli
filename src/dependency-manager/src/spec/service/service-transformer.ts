import { plainToClass } from 'class-transformer';
import { ComponentVersionSlugUtils, ServiceVersionSlugUtils } from '../..';
import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpecV1 } from '../common/interface-v1';
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

export const transformServiceInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(InterfaceSpecV1, value)
      : plainToClass(InterfaceSpecV1, { port: value });
  }
  return output;
};
