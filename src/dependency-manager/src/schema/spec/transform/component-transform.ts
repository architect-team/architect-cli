import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { ComponentSlug, ComponentSlugUtils, Slugs } from '../../../utils/slugs';
import { ComponentConfig, ComponentInstanceMetadata, ComponentInterfaceConfig, ParameterDefinitionConfig } from '../../config/component-config';
import { ComponentContext, ParameterValue, ServiceContext, TaskContext } from '../../config/component-context';
import { ServiceInterfaceConfig } from '../../config/service-config';
import { ComponentInterfaceSpec, ComponentSpec, ParameterDefinitionSpec } from '../component-spec';
import { transformServiceSpec } from './service-transform';
import { transformTaskSpec } from './task-transform';

export const transformComponentSpecName = (name: string): ComponentSlug => {
  const split = ComponentSlugUtils.parse(name);
  return ComponentSlugUtils.build(split.component_account_name, split.component_name);
};

export const transformComponentSpecTag = (tag?: string): string => {
  return tag || Slugs.DEFAULT_TAG;
};

export const transformLocalPath = (component_extends?: string): string | undefined => {
  return component_extends?.startsWith('file:') ? component_extends?.substr('file:'.length) : undefined;
};

export const transformBooleanString = (boolean_string: string | boolean): boolean => {
  if (boolean_string === 'true') {
    return true;
  } else if (boolean_string === 'false') {
    return false;
  } else if (typeof boolean_string === 'boolean') {
    return boolean_string;
  } else {
    throw new Error(`Cannot transform ${boolean_string} into a boolean`);
  }
};

export const transformParameterDefinitionSpec = (key: string, parameter_spec: string | number | boolean | ParameterDefinitionSpec | null): ParameterDefinitionConfig => {
  if (parameter_spec && typeof parameter_spec === 'object') {
    return {
      required: parameter_spec.required ? transformBooleanString(parameter_spec.required) : false,
      description: parameter_spec.description,
      default: (!parameter_spec.default && parameter_spec.required === false) ? null : parameter_spec.default,
    };
  } else {
    return {
      default: parameter_spec === null ? undefined : parameter_spec,
    };
  }
};

const transformComponentInterfaceSpec = function (_: string, interface_spec: ComponentInterfaceSpec | string): ComponentInterfaceConfig {
  return typeof interface_spec === 'string' ? { url: interface_spec } : interface_spec;
};

export const transformComponentContext = (
  config: ComponentConfig
): ComponentContext => {
  const dependency_context: Dictionary<any> = {};
  for (const dk of Object.keys(config.dependencies)) {
    dependency_context[dk] = { ingresses: {}, interfaces: {} };
  }

  const parameter_context: Dictionary<ParameterValue> = {};
  for (const [pk, pv] of Object.entries(config.parameters)) {
    if (pv.default === null) {
      parameter_context[pk] = null;
    } else {
      parameter_context[pk] = pv.default === undefined ? '' : pv.default;
    }
  }

  const interface_filler = {
    port: '',
    host: '',
    username: '',
    password: '',
    protocol: '',
    url: '',
  };

  const interface_context: Dictionary<ComponentInterfaceConfig> = {};
  const ingress_context: Dictionary<ComponentInterfaceConfig> = {};
  for (const [ik, iv] of Object.entries(config.interfaces)) {
    interface_context[ik] = {
      ...interface_filler,
      ...iv,
    };
    ingress_context[ik] = {
      ...interface_filler,
      consumers: '[]',
      dns_zone: '',
      subdomain: '',
    };
  }

  const service_context: Dictionary<ServiceContext> = {};
  for (const [sk, sv] of Object.entries(config.services)) {
    const service_interfaces: Dictionary<ServiceInterfaceConfig> = {};
    for (const [ik, iv] of Object.entries(sv.interfaces)) {
      service_interfaces[ik] = {
        ...interface_filler,
        ...iv,
      };
    }
    service_context[sk] = {
      interfaces: service_interfaces,
      environment: sv.environment,
    };
  }

  const task_context: Dictionary<TaskContext> = {};
  for (const [tk, tv] of Object.entries(config.tasks)) {
    task_context[tk] = {
      environment: tv.environment,
    };
  }

  return {
    dependencies: dependency_context,
    parameters: parameter_context,
    ingresses: ingress_context,
    interfaces: interface_context,
    services: service_context,
    tasks: task_context,
  };
};

export const transformComponentSpec = (spec: ComponentSpec, source_yml: string, tag: string, instance_metadata?: ComponentInstanceMetadata): ComponentConfig => {
  const parameters = transformDictionary(transformParameterDefinitionSpec, spec.parameters);
  const services = transformDictionary(transformServiceSpec, spec.services, spec.name, tag, instance_metadata);
  const tasks = transformDictionary(transformTaskSpec, spec.tasks, spec.name, tag, instance_metadata);
  const interfaces = transformDictionary(transformComponentInterfaceSpec, spec.interfaces);
  const dependencies = spec.dependencies || {};

  const name = transformComponentSpecName(spec.name);

  return {
    name,
    tag,

    instance_metadata: instance_metadata,

    description: spec.description,
    keywords: spec.keywords || [],
    author: spec.author,
    homepage: spec.homepage,

    parameters,

    services,
    tasks,

    dependencies,

    interfaces,

    artifact_image: spec.artifact_image,

    source_yml,

    context: transformComponentContext(
      {
        dependencies,
        parameters,
        interfaces,
        services,
        tasks,
      } as ComponentConfig
    ),
  };
};
