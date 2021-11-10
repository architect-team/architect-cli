import { Dictionary } from '../utils/dictionary';
import { ComponentInterfaceConfig } from './component-config';
import { ServiceInterfaceConfig } from './service-config';

export type OutputValue = string | number | boolean | null;
// eslint-disable-next-line @typescript-eslint/ban-types
export type ParameterValue = string | number | boolean | null | object | undefined;

export interface ServiceContext {
  interfaces: Dictionary<ServiceInterfaceConfig>;
}

export interface DependencyContext {
  outputs: Dictionary<OutputValue>;
  ingresses: Dictionary<ComponentInterfaceConfig>;
  interfaces: Dictionary<ComponentInterfaceConfig>;
}

export interface ComponentContext {
  name?: string;
  dependencies?: Dictionary<DependencyContext>;
  parameters?: Dictionary<ParameterValue>;
  outputs?: Dictionary<OutputValue>;
  ingresses?: Dictionary<ComponentInterfaceConfig>;
  interfaces?: Dictionary<ComponentInterfaceConfig>;
  services?: Dictionary<ServiceContext>;

  environment?: {
    ingresses: Dictionary<Dictionary<ComponentInterfaceConfig>>;
  };
}
