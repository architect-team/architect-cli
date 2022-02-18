import { ComponentInstanceMetadata, ComponentSpec } from '../spec/component-spec';
import { ComponentVersionSlugUtils, ParsedResourceVersionSlug, ResourceType, ResourceVersionSlugUtils, Slugs } from '../spec/utils/slugs';
import { Dictionary } from '../utils/dictionary';
import { Refs } from '../utils/refs';
import { ServiceConfig } from './service-config';
import { TaskConfig } from './task-config';

export interface IngressConfig {
  enabled?: boolean;
  subdomain?: string;
  path?: string;
  ip_whitelist?: string[];
}

export interface ComponentNodeConfig {
  outputs: Dictionary<OutputDefinitionConfig>,
  interfaces: Dictionary<ComponentInterfaceConfig>
}

export interface ComponentInterfaceConfig {
  description?: string;
  host?: null | string;
  port?: number | string;
  protocol?: string;
  username?: null | string;
  password?: null | string;
  url: string;
  sticky?: boolean | string;

  ingress?: IngressConfig;

  consumers?: string[];
  dns_zone?: string;
  subdomain?: string;
  path?: string;
}

export interface ParameterDefinitionConfig {
  required?: boolean | string;

  description?: string;

  // eslint-disable-next-line @typescript-eslint/ban-types
  default?: boolean | number | object | string | null;
}

export interface OutputDefinitionConfig {
  description?: string;
  value: boolean | number | string | null;
}

export interface ComponentConfig {
  name: string;

  metadata: ComponentInstanceMetadata;

  description?: string;
  keywords: string[];
  author?: string;
  homepage?: string;

  parameters: Dictionary<ParameterDefinitionConfig>;
  outputs: Dictionary<OutputDefinitionConfig>;

  services: Dictionary<ServiceConfig>;
  tasks: Dictionary<TaskConfig>;
  dependencies: Dictionary<string>;

  interfaces: Dictionary<ComponentInterfaceConfig>;

  artifact_image?: string;
}

export const resourceRefToNodeRef = (resource_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  let parsed;
  try {
    parsed = ResourceVersionSlugUtils.parse(resource_ref);
  } catch {
    parsed = ComponentVersionSlugUtils.parse(resource_ref);
  }
  if (!instance_id) {
    instance_id = ComponentVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, parsed.tag, parsed.instance_name);
  }

  let friendly_name = `${parsed.component_name}`;
  if ((parsed as ParsedResourceVersionSlug).resource_name) {
    friendly_name += `-${(parsed as ParsedResourceVersionSlug).resource_name}`;
  }
  if (parsed.instance_name) {
    friendly_name += `-${parsed.instance_name}`;
  }

  if (instance_id) {
    resource_ref = `${resource_ref}${Slugs.INSTANCE_DELIMITER}${instance_id}`;
  }

  return Refs.safeRef(friendly_name, resource_ref, max_length);
};

export const buildNodeRef = (component_config: ComponentConfig, resource_type: ResourceType, resource_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  const component_ref = component_config.metadata.ref;
  const parsed = ComponentVersionSlugUtils.parse(component_ref);
  const service_ref = ResourceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, resource_type, resource_name, parsed.tag, component_config.metadata?.instance_name);
  return resourceRefToNodeRef(service_ref, component_config.metadata?.instance_id, max_length);
};

export function buildInterfacesRef(component_config: ComponentSpec | ComponentConfig): string {
  const component_ref = component_config.metadata.ref;
  return resourceRefToNodeRef(component_ref, component_config.metadata?.instance_id);
}

export const getServiceByRef = (component_config: ComponentConfig, service_ref: string): ServiceConfig | undefined => {
  if (service_ref.startsWith(component_config.name)) {
    const [service_name, component_tag] = service_ref.substr(component_config.name.length + 1).split(':');
    if (component_tag === component_config.metadata?.tag) {
      return component_config.services[service_name];
    }
  }
};

export const getTaskByRef = (component_config: ComponentConfig, task_ref: string): TaskConfig | undefined => {
  if (task_ref.startsWith(component_config.name)) {
    // TODO:344 substr
    const [task_name, component_tag] = task_ref.substr(component_config.name.length + 1).split(':');
    if (component_tag === component_config.metadata?.tag) {
      return component_config.tasks[task_name];
    }
  }
};
