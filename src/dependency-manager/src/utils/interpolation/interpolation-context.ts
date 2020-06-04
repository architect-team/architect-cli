import { ParameterValue } from '../../service-config/base';
import { Dictionary } from '../dictionary';

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
