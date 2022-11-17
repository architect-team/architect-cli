import { ComponentInstanceMetadata } from '../spec/component-spec';
import { ComponentSlugUtils, ParsedResourceSlug, ResourceSlugUtils, ResourceType } from '../spec/utils/slugs';
import { Dictionary } from '../utils/dictionary';
import { Refs } from '../utils/refs';
import { ServiceConfig } from './service-config';
import { TaskConfig } from './task-config';

export interface IngressConfig {
  enabled?: boolean;
  subdomain?: string;
  path?: string;
  ip_whitelist?: string[];
  sticky?: boolean | string;

  // Context
  consumers?: string[];
  dns_zone?: string;
  host?: null | string;
  port?: number | string;
  protocol?: string;
  username?: null | string;
  password?: null | string;
  url?: string;
}

export interface SecretDefinitionConfig {
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

  secrets: Dictionary<SecretDefinitionConfig>;
  outputs: Dictionary<OutputDefinitionConfig>;

  services: Dictionary<ServiceConfig>;
  tasks: Dictionary<TaskConfig>;
  dependencies: Dictionary<string>;

  artifact_image?: string;
}

export const resourceRefToNodeRef = (resource_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
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

  const resource_type = (parsed as ParsedResourceSlug).resource_type;
  if (resource_type === 'tasks') {
    ref = `${ref}--task`;
  } else if (resource_type && resource_type !== 'services') {
    throw new Error(`Invalid resource type: ${resource_type}`);
  }

  if (parsed.instance_name) {
    ref = `${ref}---${parsed.instance_name}`;
  }

  if (ref.length > max_length) {
    return Refs.safeRef(ref, max_length);
  } else {
    return ref;
  }
};

export const buildNodeRef = (component_config: ComponentConfig, resource_type: ResourceType, resource_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  if (component_config[resource_type][resource_name]) {
    const reserved_name = component_config[resource_type][resource_name].reserved_name;
    if (reserved_name) {
      return reserved_name;
    }
  }

  const component_ref = component_config.metadata.ref;
  const parsed = ComponentSlugUtils.parse(component_ref);
  const service_ref = ResourceSlugUtils.build(parsed.component_account_name, parsed.component_name, resource_type, resource_name, component_config.metadata?.instance_name);
  return resourceRefToNodeRef(service_ref, component_config.metadata?.instance_id, max_length);
};
