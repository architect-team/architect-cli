import { Dictionary } from '../../utils/dictionary';
import { Refs } from '../../utils/refs';
import { ComponentSlugUtils, ComponentVersionSlug, ComponentVersionSlugUtils, ServiceVersionSlugUtils, Slugs } from '../../utils/slugs';
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
  required?: boolean | string;

  description?: string;

  default?: boolean | number | string | null;
}

export interface ComponentInstanceMetadata {
  instance_name: string;
  instance_id: string;
  instance_date: Date;

  local_path?: string;
}

export interface ComponentVersionMetadata {
  tag: string;
}

// TODO:269: we should consider wrapping ComponentConfig in a ComponentVersionConfig and a ComponentInstanceConfig:
// this allows us to factor out `tag` from `buildComponentConfig` and only apply it when it is needed
// the graph then could be a graph of ComponentVersions or ComponentInstances
//
// export interface ComponentVersion {
//   tag: string;
//   config: ComponentConfig;
// }

// export interface ComponentInstance {
//   component: ComponentVersion;

//   instance_name: string;
//   instance_id: string;
//   instance_date: Date;
// }

export interface ComponentConfig {
  name: string;

  // TODO:269: we should consider allowing these to live next to the ComponentConfig instead of attached to it
  tag: string;
  instance_metadata?: ComponentInstanceMetadata;

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

  source_yml: string;
  context: ComponentContext;
}

export const buildComponentRef = (config: ComponentConfig): ComponentVersionSlug => {
  const split = ComponentSlugUtils.parse(config.name);
  return ComponentVersionSlugUtils.build(split.component_account_name, split.component_name, config.tag, config.instance_metadata?.instance_name);
};

// TODO:269: is there any real use case for buildNodeRef? why is it separate from `getNodeRef`?
// and what is "resource_ref" if we are building a resource ref?
export const resourceRefToNodeRef = (resource_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  let parsed;
  try {
    parsed = ServiceVersionSlugUtils.parse(resource_ref);
  } catch {
    parsed = ComponentVersionSlugUtils.parse(resource_ref);
  }
  if (!instance_id) {
    instance_id = ComponentVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, parsed.tag, parsed.instance_name);
  }

  let friendly_name = `${parsed.component_name}`;
  if (parsed.service_name) {
    friendly_name += `-${parsed.service_name}`;
  }
  if (parsed.instance_name) {
    friendly_name += `-${parsed.instance_name}`;
  }

  if (instance_id) {
    resource_ref = `${resource_ref}${Slugs.INSTANCE_DELIMITER}${instance_id}`;
  }

  return Refs.safeRef(friendly_name, resource_ref, max_length);
};

export const buildNodeRef = (component_config: ComponentConfig, service_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH) => {
  const component_ref = buildComponentRef(component_config);
  const parsed = ComponentVersionSlugUtils.parse(component_ref);
  const service_ref = ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, service_name, parsed.tag, component_config.instance_metadata?.instance_name);
  return resourceRefToNodeRef(service_ref, component_config.instance_metadata?.instance_id, max_length);
};

export const buildInterfacesRef = (component_config: ComponentConfig, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  // instance_id must be set to be unique across environments
  const component_ref = buildComponentRef(component_config);
  return resourceRefToNodeRef(component_ref, component_config.instance_metadata?.instance_id, max_length);
};

export const getServiceByRef = (component_config: ComponentConfig, service_ref: string): ServiceConfig | undefined => {
  if (service_ref.startsWith(component_config.name)) {
    const [service_name, component_tag] = service_ref.substr(component_config.name.length + 1).split(':');
    if (component_tag === component_config.tag) {
      return component_config.services[service_name];
    }
  }
};

export const getTaskByRef = (component_config: ComponentConfig, task_ref: string): TaskConfig | undefined => {
  if (task_ref.startsWith(component_config.name)) {
    const [task_name, component_tag] = task_ref.substr(component_config.name.length + 1).split(':');
    if (component_tag === component_config.tag) {
      return component_config.tasks[task_name];
    }
  }
};
