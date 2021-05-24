import { Dictionary } from '../../utils/dictionary';
import { ComponentConfigBuilder } from './component-builder';
import { ComponentConfig } from './component-config';

export const transformComponents = (input?: Dictionary<any>): Dictionary<ComponentConfig> | undefined => {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  const output: Dictionary<ComponentConfig> = {};
  // eslint-disable-next-line prefer-const
  for (let [key, value] of Object.entries(input)) {
    if (!value) value = {};

    if (typeof value?.extends === 'number') {
      value.extends = value.extends.toString();
    }

    if (value instanceof Object) {
      if (value.extends && !value.extends.includes(':')) {
        value.extends = `${key}:${value.extends}`;
      }
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: key, ...value, name: key });
    } else {
      output[key] = ComponentConfigBuilder.buildFromJSON({ extends: value.includes(':') || value.startsWith('file:') ? value : `${key}:${value}`, name: key });
    }
  }
  return output;
};
