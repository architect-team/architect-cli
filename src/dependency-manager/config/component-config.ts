import { ComponentInstanceMetadata, ComponentSpec, DependencySpec } from '../spec/component-spec';
import { SecretSpecValue } from '../spec/secret-spec';
import { ComponentSlugUtils, ParsedResourceSlug, ResourceSlugUtils, ResourceType, Slugs } from '../spec/utils/slugs';
import { Dictionary } from '../utils/dictionary';
import { Refs } from '../utils/refs';
import { DatabaseConfig, ServiceConfig } from './service-config';
import { TaskConfig } from './task-config';

export interface SecretDefinitionConfig {
  required?: boolean | string;

  description?: string;

  default?: SecretSpecValue;
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
  databases: Dictionary<DatabaseConfig>;
  tasks: Dictionary<TaskConfig>;
  dependencies: Dictionary<DependencySpec>;

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

  const resource_name = (parsed as ParsedResourceSlug).resource_name;
  if (resource_name) {
    ref = `${ref}--${resource_name}`;
  }

  const resource_type = (parsed as ParsedResourceSlug).resource_type;
  if (resource_type === 'tasks') {
    ref = `${ref}--task`;
  } else if (resource_type === 'databases') {
    ref = `${ref}${Slugs.DB_SUFFIX}`;
  } else if (resource_type && !(['services', 'databases'].includes(resource_type))) {
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

export const buildNodeRef = (component_config: ComponentSpec | ComponentConfig, resource_type: ResourceType, resource_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  const resource = component_config[resource_type];
  if (resource && resource[resource_name]) {
    // Not all types have a reserved name.
    const reserved_name = (resource[resource_name] as any).reserved_name || '';
    if (reserved_name) {
      return reserved_name;
    }
  }

  const component_ref = component_config.metadata.ref;
  const parsed = ComponentSlugUtils.parse(component_ref);
  const service_ref = ResourceSlugUtils.build(parsed.component_name, resource_type, resource_name, component_config.metadata?.instance_name);
  return resourceRefToNodeRef(service_ref, component_config.metadata?.instance_id, max_length);
};
