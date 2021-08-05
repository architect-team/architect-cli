import { Dictionary } from '../../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { InterfaceConfig } from './service-config';

export type ParameterValue = string | number | boolean | null | undefined;

export interface ServiceContext {
  environment: Dictionary<string>;
  interfaces: Dictionary<InterfaceConfig>;
}

export interface TaskContext {
  environment: Dictionary<string>;
}

export interface ComponentContext {
  dependencies: Dictionary<ComponentContext>;
  parameters: Dictionary<ParameterValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<InterfaceConfig>;
  services: Dictionary<ServiceContext>;
  tasks: Dictionary<TaskContext>;
}
