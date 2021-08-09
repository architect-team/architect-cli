import { Dictionary } from '../../utils/dictionary';
import { Refs } from '../../utils/refs';
import { ComponentVersionSlugUtils, ServiceVersionSlugUtils, Slugs } from '../../utils/slugs';
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

  source_yml: string;

  context: ComponentContext;
}

// TODO:269: is there any real use case for buildNodeRef? why is it separate from `getNodeRef`?
export const buildRef = (service_ref: string, instance_id = '', max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  let parsed;
  try {
    parsed = ServiceVersionSlugUtils.parse(service_ref);
  } catch {
    parsed = ComponentVersionSlugUtils.parse(service_ref);
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
    service_ref = `${service_ref}${Slugs.INSTANCE_DELIMITER}${instance_id}`;
  }

  return Refs.safeRef(friendly_name, service_ref, max_length);
};

export const buildNodeRef = (component_config: ComponentConfig, service_name: string, max_length: number = Refs.DEFAULT_MAX_LENGTH) => {
  const parsed = ComponentVersionSlugUtils.parse(component_config.ref);
  const service_ref = ServiceVersionSlugUtils.build(parsed.component_account_name, parsed.component_name, service_name, parsed.tag, component_config.instance_name);
  return buildRef(service_ref, component_config.instance_id, max_length);
};

export const buildInterfacesRef = (component_config: ComponentConfig, max_length: number = Refs.DEFAULT_MAX_LENGTH): string => {
  // instance_id must be set to be unique across environments
  return buildRef(component_config.ref, component_config.instance_id, max_length);
};

export const getServiceByRef = (component_config: ComponentConfig, service_ref: string): ServiceConfig | undefined => {
  if (service_ref.startsWith(component_config.name)) {
    const [service_name, component_tag] = service_ref.substr(component_config.name.length + 1).split(':');
    if (component_tag === component_config.tag) {
      return component_config.services[service_name];
    }
  }
};
