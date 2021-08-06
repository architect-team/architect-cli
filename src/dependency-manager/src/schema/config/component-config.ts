import { Dictionary } from '../../utils/dictionary';
import { ComponentContext } from './component-context';
import { InterfaceConfig, ServiceConfig } from './service-config';
import { TaskConfig } from './task-config';

export interface IngressConfig {
  enabled?: boolean;
  subdomain?: string;
}

export interface ComponentInterfaceConfig extends InterfaceConfig {
  ingress?: IngressConfig;

  consumers?: string[];
  dns_zone?: string;
  subdomain?: string;
}

export interface ParameterDefinitionConfig {
  required?: boolean;

  description?: string;

  default?: boolean | number | string | null;
}

export interface ComponentConfig {
  name: string;
  tag: string;
  ref: string;

  instance_id: string;
  instance_name: string;
  instance_date: Date;

  extends?: string;
  local_path?: string;

  description?: string;
  keywords: string[];
  author?: string;
  homepage?: string;

  parameters: Dictionary<ParameterDefinitionConfig>;

  services: Dictionary<ServiceConfig>;
  tasks: Dictionary<TaskConfig>;
  dependencies: Dictionary<string>;

  interfaces: Dictionary<ComponentInterfaceConfig>;

  artifact_image?: string;

  context: ComponentContext;
}
