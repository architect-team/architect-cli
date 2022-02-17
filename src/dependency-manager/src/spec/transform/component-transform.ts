import { ComponentConfig, ComponentInterfaceConfig, OutputDefinitionConfig, ParameterDefinitionConfig } from '../../config/component-config';
import { transformDictionary } from '../../utils/dictionary';
import { ComponentInterfaceSpec, ComponentSpec, OutputDefinitionSpec, ParameterDefinitionSpec } from '../component-spec';
import { Slugs } from '../utils/slugs';
import { transformServiceSpec } from './service-transform';
import { transformTaskSpec } from './task-transform';

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

export const transformComponentInterfaceSpec = function (_: string, interface_spec: ComponentInterfaceSpec | string): ComponentInterfaceConfig {
  return typeof interface_spec === 'string' ? { url: interface_spec } : interface_spec;
};

export const transformComponentSpec = (spec: ComponentSpec): ComponentConfig => {
  const parameters = transformDictionary(transformParameterDefinitionSpec, spec.parameters);
  const outputs = transformDictionary(transformOutputDefinitionSpec, spec.outputs);
  const services = transformDictionary(transformServiceSpec, spec.services, spec.metadata);
  const tasks = transformDictionary(transformTaskSpec, spec.tasks, spec.metadata);
  const interfaces = transformDictionary(transformComponentInterfaceSpec, spec.interfaces);
  const dependencies = spec.dependencies || {};

  return {
    name: spec.name,

    metadata: spec.metadata,

    description: spec.description,
    keywords: spec.keywords || [],
    author: spec.author,
    homepage: spec.homepage,

    parameters,
    outputs,

    services,
    tasks,

    dependencies,

    interfaces,

    artifact_image: spec.artifact_image,
  };
};
