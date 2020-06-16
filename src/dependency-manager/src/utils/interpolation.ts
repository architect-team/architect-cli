import Mustache, { Context, Writer } from 'mustache';
import { ParameterValue } from '../service-config/base';
import { Dictionary } from './dictionary';

export type EnvironmentParameterMap = { [key: string]: ParameterContext };

export interface InterpolationContext {
  parameters: ParameterContext;
  services: {
    interfaces: ServiceInterfaceContext;
  };
  dependencies: Dictionary<InterpolationContext>;
}

export type ParameterContext = { [key: string]: ParameterValue };

export type EnvironmentInterpolationContext = { [key: string]: InterpolationContext };

export type ServiceInterfaceContext = { [key: string]: InterfaceContext };

export type EnvironmentInterfaceContext = { [key: string]: ServiceInterfaceContext };

export interface InterfaceContext {
  port: string;
  host: string;
  protocol: string;
  url: string;
  subdomain?: string;
  external: {
    port?: string;
    host?: string;
    protocol?: string;
    url?: string;
    subdomain?: string;
  };
  internal: {
    port: string;
    host: string;
    protocol: string;
    url: string;
    subdomain?: string;
  };
}

/*
Mustache doesn't respect bracket key lookups. This method transforms the following:
${ dependencies['architect/cloud'].services } -> ${ dependencies.architect/cloud.services }
${ dependencies["architect/cloud"].services } -> ${ dependencies.architect/cloud.services }
*/
export const replaceBrackets = (value: string) => {
  const mustache_regex = new RegExp(`\\\${(.*?)}`, 'g');
  let matches;
  let res = value;
  while ((matches = mustache_regex.exec(value)) != null) {
    const sanitized_value = matches[0].replace(/\['/g, '.').replace(/'\]/g, '').replace(/\[\\"/g, '.').replace(/\\"\]/g, '');
    res = res.replace(matches[0], sanitized_value);
  }
  return res;
};


export const escapeJSON = (value: string) => {
  // Support json strings
  try {
    const escaped = JSON.stringify(value);
    if (`${value}` !== escaped) {
      value = escaped.substr(1, escaped.length - 2);
    }
    // eslint-disable-next-line no-empty
  } catch { }
  return value;
};

Mustache.escape = function (text) {
  return escapeJSON(text);
}; // turns off HTML escaping
Mustache.tags = ['${', '}']; // sets custom delimiters

export const interpolateString = (param_value: string, context: any, ignore_keys: string[] = []): string => {
  const writer = new Writer();
  let errors: any = [];

  const render = writer.render;
  writer.render = function (template, view, partials) {

    view = new Context(view, undefined);
    const lookup = view.lookup;
    view.lookup = function (name: string) {
      const value = lookup.bind(this)(name);
      if (value === undefined) {
        const ignored = ignore_keys.some((k) => name.startsWith(k));
        if (!ignored) {
          errors.push(name);
        }
      }
      return value;
    };

    const result = render.bind(this)(template, view, partials);
    if (errors.length > 0) {
      throw new Error("Unknown symbols: " + errors.join(", "));
    }
    return result;
  };

  const mustache_regex = new RegExp(`\\\${(.*?)}`, 'g');
  const MAX_DEPTH = 10;
  let depth = 0;
  while (depth < MAX_DEPTH) {
    param_value = replaceBrackets(param_value);
    param_value = writer.render(param_value, context);
    if (!mustache_regex.test(param_value)) break;
    depth += 1;
  }

  if (errors.length) {
    errors = [];
    throw new Error(errors);
  }

  //TODO:77: add validation logic to catch expressions that don't refer to an existing path
  return param_value;
};


