import { ComponentConfig, OutputDefinitionConfig, SecretDefinitionConfig } from '../../config/component-config';
import { transformDictionary } from '../../utils/dictionary';
import { ComponentSpec, OutputDefinitionSpec, SecretDefinitionSpec } from '../component-spec';
import { Slugs } from '../utils/slugs';
import { transformServiceSpec } from './service-transform';
import { transformTaskSpec } from './task-transform';

export const transformComponentSpecTag = (tag?: string): string => {
  return tag || Slugs.DEFAULT_TAG;
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

export const transformSecretDefinitionSpec = (key: string, secret_spec: string | number | boolean | SecretDefinitionSpec | null): SecretDefinitionConfig => {
  if (secret_spec && typeof secret_spec === 'object') {
    return {
      required: secret_spec.required ? transformBooleanString(secret_spec.required) : true,
      description: secret_spec.description,
      default: (!secret_spec.default && secret_spec.required === false) ? null : secret_spec.default,
    };
  } else {
    return {
      default: secret_spec === null ? undefined : secret_spec,
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

export const transformComponentSpec = (spec: ComponentSpec): ComponentConfig => {
  const secrets = transformDictionary(transformSecretDefinitionSpec, spec.secrets);
  const outputs = transformDictionary(transformOutputDefinitionSpec, spec.outputs);
  const services = transformDictionary(transformServiceSpec, spec.services, spec.metadata);
  const tasks = transformDictionary(transformTaskSpec, spec.tasks, spec.metadata);
  const dependencies = spec.dependencies || {};

  return {
    name: spec.name,

    metadata: spec.metadata,

    description: spec.description,
    keywords: spec.keywords || [],
    author: spec.author,
    homepage: spec.homepage,

    secrets,
    outputs,

    services,
    tasks,

    dependencies,

    artifact_image: spec.artifact_image,
  };
};
