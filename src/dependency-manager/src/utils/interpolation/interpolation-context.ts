import { ParameterValueV2 } from '../../service-config/base';

export type EnvironmentParameterMap = { [key: string]: ParameterContext };

export interface InterpolationContext {
  parameters: ParameterContext;
  interfaces: InterfaceContext;
}

export type ParameterContext = { [key: string]: ParameterValueV2 };

export type EnvironmentInterpolationContext = { [key: string]: InterpolationContext };

export type InterfaceContext = { [key: string]: ServiceInterfaceContext };

export interface ServiceInterfaceContext {
  port: string;
  subdomain: string;
  host: string;
  protocol: string;
  url: string;
  external: {
    port: string;
    subdomain: string;
    host: string;
    protocol: string;
    url: string;
  };
  internal: {
    port: string;
    subdomain: string;
    host: string;
    protocol: string;
    url: string;
  };
}
