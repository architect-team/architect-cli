import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { ParameterDefinitionSpecV1 } from './parameter-v1';

export const transformParameters = (input?: Dictionary<any>): Dictionary<ParameterDefinitionSpecV1> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<ParameterDefinitionSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value && typeof value === 'object') {
      if (!value.default && value.required === 'false') {
        value.default = null;
      }
      output[key] = plainToClass(ParameterDefinitionSpecV1, value);
    } else {
      output[key] = plainToClass(ParameterDefinitionSpecV1, {
        default: value === null ? undefined : value,
      });
    }
  }
  return output;
};
