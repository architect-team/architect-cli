import { Dictionary } from '../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { ServiceInterfaceConfig } from './service-config';

export type OutputValue = string | number | boolean | null;
// eslint-disable-next-line @typescript-eslint/ban-types
export type ParameterValue = string | number | boolean | null | object | undefined;

export interface ServiceContext {
  environment: Dictionary<string | null>;
  interfaces: Dictionary<ServiceInterfaceConfig>;
}

export interface SidecarContext {
  environment: Dictionary<string | null>;
}

export interface TaskContext {
  environment: Dictionary<string | null>;
}

export interface ComponentContext {
  name: string;
  dependencies: Dictionary<ComponentContext>;
  parameters: Dictionary<ParameterValue>;
  outputs: Dictionary<OutputValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<ComponentInterfaceConfig>;
  services: Dictionary<ServiceContext>;
  sidecars: Dictionary<SidecarContext>;
  tasks: Dictionary<TaskContext>;

  environment?: {
    ingresses: Dictionary<Dictionary<ComponentInterfaceConfig>>;
  };

  [name: string]: any;
}
