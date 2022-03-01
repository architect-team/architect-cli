import { ComponentInstanceMetadata, ComponentSpec } from '../spec/component-spec';
import { ComponentSlugUtils, ParsedResourceSlug, ResourceSlugUtils, ResourceType, Slugs } from '../spec/utils/slugs';
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

export const ecsResourceRefToNodeRef = (resource_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  let parsed;
  try {
    parsed = ResourceSlugUtils.parse(resource_ref);
  } catch {
    parsed = ComponentSlugUtils.parse(resource_ref);
  }
  if (!instance_id) {
    instance_id = ComponentSlugUtils.build(parsed.component_account_name, parsed.component_name, parsed.instance_name);
  }

  let friendly_name = `${parsed.component_name}`;
  if ((parsed as ParsedResourceSlug).resource_name) {
    friendly_name += `-${(parsed as ParsedResourceSlug).resource_name}`;
  }
  if (parsed.instance_name) {
    friendly_name += `-${parsed.instance_name}`;
  }

  if (instance_id) {
    resource_ref = `${resource_ref}${Slugs.INSTANCE_DELIMITER}${instance_id}`;
  }

  return Refs.safeRef(friendly_name, resource_ref, max_length);
};

export const resourceRefToNodeRef = (resource_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH, ecs = false): string => {
  if (ecs) {
    return ecsResourceRefToNodeRef(resource_ref, instance_id, max_length);
  }

  let parsed;
  try {
    parsed = ResourceSlugUtils.parse(resource_ref);
  } catch {
    parsed = ComponentSlugUtils.parse(resource_ref);
  }

  let ref = `${parsed.component_name}`;

  if (parsed.component_account_name) {
    ref = `${parsed.component_account_name}---${ref}`;
  }

  const resource_name = (parsed as ParsedResourceSlug).resource_name;
  if (resource_name) {
    ref = `${ref}--${resource_name}`;
  }

  if (parsed.instance_name) {
    ref = `${ref}---${parsed.instance_name}`;
  }

  const resource_type = (parsed as ParsedResourceSlug).resource_type;
  if (resource_type === 'tasks') {
    ref = `${ref}.task`;
  } else if (resource_type && resource_type !== 'services') {
    throw new Error(`Invalid resource type: ${resource_type}`);
  }

  if (ref.length > max_length) {
    return Refs.safeRef(ref, max_length);
  } else {
    return ref;
  }
};

export const buildNodeRef = (component_config: ComponentConfig, resource_type: ResourceType, resource_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  const component_ref = component_config.metadata.ref;
  const parsed = ComponentSlugUtils.parse(component_ref);
  const service_ref = ResourceSlugUtils.build(parsed.component_account_name, parsed.component_name, resource_type, resource_name, component_config.metadata?.instance_name);
  return resourceRefToNodeRef(service_ref, component_config.metadata?.instance_id, max_length, !!component_config.metadata.proxy_port_mapping);
};

export function buildInterfacesRef(component_config: ComponentSpec | ComponentConfig): string {
  const component_ref = component_config.metadata.ref;
  return resourceRefToNodeRef(component_ref, component_config.metadata?.instance_id, Refs.DEFAULT_MAX_LENGTH, !!component_config.metadata.proxy_port_mapping);
}
