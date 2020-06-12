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
  port: number;
  host: string;
  protocol: string;
  url: string;
  subdomain?: string;
  external: {
    port?: number;
    host?: string;
    protocol?: string;
    url?: string;
    subdomain?: string;
  };
  internal: {
    port: number;
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
