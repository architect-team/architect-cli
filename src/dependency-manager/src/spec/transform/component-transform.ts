import { ComponentConfig, ComponentInstanceMetadata, ComponentInterfaceConfig, OutputDefinitionConfig, ParameterDefinitionConfig } from '../../config/component-config';
import { ComponentContext, OutputValue, ParameterValue, ServiceContext, SidecarContext, TaskContext } from '../../config/component-context';
import { ServiceInterfaceConfig } from '../../config/service-config';
import { Dictionary, transformDictionary } from '../../utils/dictionary';
import { ComponentInterfaceSpec, ComponentSpec, OutputDefinitionSpec, ParameterDefinitionSpec } from '../component-spec';
import { ServiceSpec } from '../service-spec';
import { ComponentSlug, ComponentSlugUtils, Slugs } from '../utils/slugs';
import { transformServiceSpec } from './service-transform';
import { transformSidecarSpec } from './sidecar-transform';
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
      required: parameter_spec.required ? transformBooleanString(parameter_spec.required) : true,
      description: parameter_spec.description,
      default: (!parameter_spec.default && parameter_spec.required === false) ? null : parameter_spec.default,
    };
  } else {
    return {
      default: parameter_spec === null ? undefined : parameter_spec,
    };
  }
};

export const transformOutputDefinitionSpec = (key: string, output_spec: string | number | boolean | OutputDefinitionSpec | null): OutputDefinitionConfig => {
  if (output_spec && typeof output_spec === 'object') {
    return {
      description: output_spec.description,
      value: output_spec.value,
    };
  } else {
    return {
      value: output_spec,
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

  const output_context: Dictionary<OutputValue> = {};
  for (const [pk, pv] of Object.entries(config.outputs)) {
    output_context[pk] = pv.value;
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
      consumers: [],
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

  const sidecar_context: Dictionary<SidecarContext> = {};
  for (const [sk, sv] of Object.entries(config.sidecars)) {
    sidecar_context[sk] = {
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
    name: config.name,
    dependencies: dependency_context,
    parameters: parameter_context,
    outputs: output_context,
    ingresses: ingress_context,
    interfaces: interface_context,
    services: service_context,
    sidecars: sidecar_context,
    tasks: task_context,
  };
};

export const transformComponentSpec = (spec: ComponentSpec, source_yml: string, tag: string, instance_metadata?: ComponentInstanceMetadata): ComponentConfig => {
  // Inject the component-level sidecars into each of the component service specs
  let spec_services = spec.services;
  if (spec_services) {
    spec_services = Object.entries(spec_services).reduce((acc, [service_name, service_spec]) => {
      const merged_sidecars = { ...spec.sidecars, ...service_spec.sidecars };
      const merged_service = { ...service_spec, sidecars: merged_sidecars };
      return { ...acc, [service_name]: merged_service };
    }, {} as Dictionary<ServiceSpec>);
  }

  const parameters = transformDictionary(transformParameterDefinitionSpec, spec.parameters);
  const outputs = transformDictionary(transformOutputDefinitionSpec, spec.outputs);
  const services = transformDictionary(transformServiceSpec, spec_services, spec.name, tag, instance_metadata);
  const sidecars = transformDictionary(transformSidecarSpec, spec.sidecars, spec.name, tag, instance_metadata);
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
    outputs,

    services,
    sidecars,
    tasks,

    dependencies,

    interfaces,

    artifact_image: spec.artifact_image,

    source_yml,

    context: transformComponentContext(
      {
        dependencies,
        parameters,
        outputs,
        interfaces,
        services,
        sidecars,
        tasks,
      } as ComponentConfig
    ),
  };
};
