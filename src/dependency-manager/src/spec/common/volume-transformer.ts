import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { VolumeSpecV1 } from './volume-v1';

//TODO:269:delete
export const transformVolumes = (input?: Dictionary<string | Dictionary<any>>): Dictionary<VolumeSpecV1> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<VolumeSpecV1> = {};

  for (const [key, value] of Object.entries(input)) {
    output[key] = value instanceof Object
      ? plainToClass(VolumeSpecV1, value)
      : plainToClass(VolumeSpecV1, { host_path: value });
  }
  return output;
};
