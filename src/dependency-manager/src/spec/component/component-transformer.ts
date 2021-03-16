import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpecV1 } from '../common/interface-v1';
import { ComponentConfigBuilder } from './component-builder';
import { ComponentConfig } from './component-config';

export const transformComponents = (input?: Dictionary<any>, parent?: any): Dictionary<ComponentConfig> | undefined => {
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

export const transformComponentInterfaces = function (input?: Dictionary<string | Dictionary<any>>): Dictionary<InterfaceSpecV1> | undefined {
  if (!input) {
    return {};
  }
  if (!(input instanceof Object)) {
    return input;
  }

  // TODO: Be more flexible than just url ref
  const output: Dictionary<InterfaceSpecV1> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value instanceof Object && 'host' in value && 'port' in value) {
      output[key] = plainToClass(InterfaceSpecV1, value);
    } else {
      let host, port, protocol, username, password;
      let url = value instanceof Object ? value.url : value;

      const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
      const matches = url_regex.exec(url);
      if (matches) {
        host = `\${{ ${matches[1]}.host }}`;
        port = `\${{ ${matches[1]}.port }}`;
        protocol = `\${{ ${matches[1]}.protocol }}`;
        username = `\${{ ${matches[1]}.username }}`;
        password = `\${{ ${matches[1]}.password }}`;
        url = `\${{ ${matches[1]}.url }}`;

        output[key] = plainToClass(InterfaceSpecV1, {
          host,
          port,
          username,
          password,
          protocol,
          url,
        });
      } else {
        throw new Error(`Invalid interface regex: ${url}`);
      }
    }
  }

  return output;
};
