import deepmerge from 'deepmerge';
import { ServiceConfig } from '../../..';
import { ComponentConfig, ComponentInterfaceConfig, OutputDefinitionConfig, SecretDefinitionConfig } from '../../config/component-config';
import { Dictionary, transformDictionary } from '../../utils/dictionary';
import { ComponentInterfaceSpec, ComponentSpec, OutputDefinitionSpec, SecretDefinitionSpec } from '../component-spec';
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

const getProtocol = (url: string): string | undefined => {
  try {
    return (new URL(url)).protocol.slice(0, -1);
  } catch {
    return undefined;
  }
};

export const transformComponentInterfaceSpec = function (_: string, interface_spec: ComponentInterfaceSpec | string): ComponentInterfaceConfig {
  return typeof interface_spec === 'string' ? {
    url: interface_spec,
    protocol: getProtocol(interface_spec),
  } : {
    ...interface_spec,
    protocol: getProtocol(interface_spec.url),
  };
};

function deprecatedInterfaces(spec: ComponentSpec, services: Dictionary<ServiceConfig>) {
  const interfaces = transformDictionary(transformComponentInterfaceSpec, spec.interfaces);
  for (const [interface_name, interface_config] of Object.entries(interfaces)) {
    if (!interface_config.ingress) {
      continue;
    }

    const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
    const matches = url_regex.exec(interface_config.url);
    if (matches) {
      const interface_ref = matches[1];

      const [services_text, service_name, interfaces_text, service_interface_name] = interface_ref.split('.');
      if (services_text !== 'services') {
        continue;
      }
      if (interfaces_text !== 'interfaces') {
        continue;
      }
      if (!(service_name in services)) {
        continue;
      }

      const service_interface = services[service_name].interfaces[service_interface_name];
      if (service_interface) {
        if (service_interface.deprecated_interface_name) {
          services[service_name].interfaces[`${service_interface_name}-${interface_name}`] = {
            ...service_interface,
            ingress: interface_config.ingress,
            deprecated_interface_name: interface_name,
          };
        } else {
          service_interface.ingress = interface_config.ingress;
          service_interface.deprecated_interface_name = interface_name;
        }
      }
    }
  }
}

export const transformComponentSpec = (spec: ComponentSpec): ComponentConfig => {
  const secrets = transformDictionary(transformSecretDefinitionSpec, deepmerge(spec.parameters || {}, spec.secrets || {})); // TODO: update
  const outputs = transformDictionary(transformOutputDefinitionSpec, spec.outputs);
  const services = transformDictionary(transformServiceSpec, spec.services, spec.metadata);
  const tasks = transformDictionary(transformTaskSpec, spec.tasks, spec.metadata);
  const dependencies = spec.dependencies || {};

  deprecatedInterfaces(spec, services);

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
