import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { ServiceConfigV1 } from './service-v1';

export function transformServices(input?: Dictionary<object | ServiceConfigV1>): Dictionary<ServiceConfigV1> {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: any = {};
  for (const [key, value] of Object.entries(input)) {
    let config;
    if (value instanceof ServiceConfigV1) {
      config = value;
    } else if (value instanceof Object) {
      config = { ...value, name: key };
    } else {
      config = { name: key };
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
