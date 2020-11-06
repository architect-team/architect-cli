import { plainToClass } from 'class-transformer';
import { Dictionary } from '../../utils/dictionary';
import { InterfaceSpecV1 } from '../common/interface-v1';

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
      let host, port, protocol;
      let url = value instanceof Object ? value.url : value;

      const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
      const matches = url_regex.exec(url);
      if (matches) {
        host = `\${{ ${matches[1]}.host }}`;
        port = `\${{ ${matches[1]}.port }}`;
        protocol = `\${{ ${matches[1]}.protocol }}`;
        url = `\${{ ${matches[1]}.protocol }}://\${{ ${matches[1]}.host }}:\${{ ${matches[1]}.port }}`;

        output[key] = plainToClass(InterfaceSpecV1, {
          host,
          port,
          protocol,
          url,
          ...(value instanceof Object && value.domains ? { domains: value.domains } : {}),
        });
      } else {
        throw new Error(`Invalid interface regex: ${url}`);
      }
    }
  }

  return output;
};
