import { Dictionary } from '../../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { ServiceInterfaceConfig } from './service-config';

export type ParameterValue = string | number | boolean | null | undefined;

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
  interfaces: Dictionary<ServiceInterfaceConfig>;
  services: Dictionary<ServiceContext>;
  tasks: Dictionary<TaskContext>;

  environment?: any; //TODO:269: we should be able to type this better
  [name: string]: any; //TODO:269: we should be able to type this better
}
