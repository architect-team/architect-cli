import { SecretSpecValue } from '../spec/secret-spec';
import { Dictionary } from '../utils/dictionary';
import { ServiceInterfaceConfig } from './service-config';

export type OutputValue = string | number | boolean | null;

export interface ServiceContext {
  environment?: Dictionary<SecretSpecValue>;
  interfaces: Dictionary<ServiceInterfaceConfig>;
}

export interface TaskContext {
  environment?: Dictionary<SecretSpecValue>;
}

export interface DependencyContext {
  outputs: Dictionary<OutputValue>;
  services: Dictionary<ServiceContext>;
}

export interface ArchitectContext {
  environment: string;
}

export interface ComponentContext {
  name: string;
  dependencies: Dictionary<DependencyContext>;
  secrets: Dictionary<SecretSpecValue>;
  outputs: Dictionary<OutputValue>;
  services: Dictionary<ServiceContext>;
  tasks: Dictionary<TaskContext>;

  architect: ArchitectContext;
}
