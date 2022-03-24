import { EnvironmentSpecValue } from '../spec/resource-spec';
import { Dictionary } from '../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { ServiceInterfaceConfig } from './service-config';

export type OutputValue = string | number | boolean | null;
// eslint-disable-next-line @typescript-eslint/ban-types
export type ParameterValue = string | number | boolean | null | object | undefined;

export interface ServiceContext {
  environment?: Dictionary<EnvironmentSpecValue>;
  interfaces: Dictionary<ServiceInterfaceConfig>;
}

export interface TaskContext {
  environment?: Dictionary<EnvironmentSpecValue>;
}

export interface DependencyContext {
  outputs: Dictionary<OutputValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<ComponentInterfaceConfig>;
}

export interface ArchitectContext {
  environment: string;
}

export interface ComponentContext {
  name: string;
  dependencies: Dictionary<DependencyContext>;
  parameters: Dictionary<ParameterValue>;
  outputs: Dictionary<OutputValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<ComponentInterfaceConfig>;
  services: Dictionary<ServiceContext>;
  tasks: Dictionary<TaskContext>;

  architect: ArchitectContext;

  // Deprecated
  environment: {
    ingresses: Dictionary<Dictionary<ComponentInterfaceConfig>>;
  };
}
