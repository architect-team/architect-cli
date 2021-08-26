import { Dictionary } from '../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { ServiceInterfaceConfig } from './service-config';

// eslint-disable-next-line @typescript-eslint/ban-types
export type ParameterValue = string | number | boolean | null | object | undefined;

export interface ServiceContext {
  environment: Dictionary<string | null>;
  interfaces: Dictionary<ServiceInterfaceConfig>;
}

export interface TaskContext {
  environment: Dictionary<string | null>;
}

export interface ComponentContext {
  dependencies: Dictionary<ComponentContext>;
  parameters: Dictionary<ParameterValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<ComponentInterfaceConfig>;
  services: Dictionary<ServiceContext>;
  tasks: Dictionary<TaskContext>;

  environment?: {
    ingresses: Dictionary<Dictionary<ComponentInterfaceConfig>>;
  };

  [name: string]: any;
}
