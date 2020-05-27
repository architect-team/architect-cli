import { ParameterValueV2 } from '../../service-config/base';

export type EnvironmentParameterMap = { [key: string]: ParameterContext };

export interface InterpolationContext {
  parameters: ParameterContext;
  interfaces: ServiceInterfaceContext;
}

export type ParameterContext = { [key: string]: ParameterValueV2 };

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
