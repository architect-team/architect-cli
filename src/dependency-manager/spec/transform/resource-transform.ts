import stringArgv from 'string-argv';
import { BuildConfig, ResourceConfig } from '../../config/resource-config';
import { Dictionary } from '../../utils/dictionary';
import { ComponentInstanceMetadata } from '../component-spec';
import { BuildSpec, ResourceSpec } from '../resource-spec';
import { SecretDefinitionSpec, SecretSpecValue } from '../secret-spec';
import { ComponentSlugUtils, ResourceSlugUtils, ResourceType } from '../utils/slugs';

export const transformResourceSpecCommand = (command: string | string[] | undefined): string[] => {
  if (!command) return [];
  if (Array.isArray(command)) {
    return command;
  }
  return stringArgv(command);
};

export const transformResourceSpecEntryPoint = (entrypoint: string | string[] | undefined): string[] => {
  if (!entrypoint) return [];
  if (Array.isArray(entrypoint)) {
    return entrypoint;
  }
  return stringArgv(entrypoint);
};

export const transformResourceSpecEnvironment = (environment?: Dictionary<SecretSpecValue | SecretDefinitionSpec>): Dictionary<string> => {
  const output: Dictionary<string> = {};
  for (const [k, v] of Object.entries(environment || {})) {
    const value = v instanceof SecretDefinitionSpec ? v.default : v;

    if (value === undefined || value === null) {
      continue;
    }

    if (value instanceof Object) {
      output[k] = JSON.stringify(value);
    } else {
      output[k] = `${value}`;
    }
  }
  return output;
};

export const transformBuildSpecArgs = (args?: Dictionary<string | null>): Dictionary<string> => {
  if (!args) {
    return {};
  }

  if (!(args instanceof Object)) {
    return args;
  }

  const output: Dictionary<string> = {};
  for (const [k, v] of Object.entries(args)) {
    output[k] = `${v}`;
  }
  return output;
};

export const transformBuildSpec = (build: BuildSpec | undefined, image?: string): BuildConfig | undefined => {
  if (!build && !image) {
    build = {};
  } else if (!build) {
    return;
  }
  return {
    context: build.context,
    buildpack: build.buildpack,
    args: transformBuildSpecArgs(build.args),
    dockerfile: build.dockerfile,
    target: build.target,
  };
};

export const transformResourceSpec = (resource_type: ResourceType, key: string, spec: ResourceSpec, metadata: ComponentInstanceMetadata): ResourceConfig => {
  const { component_account_name, component_name, instance_name } = ComponentSlugUtils.parse(metadata.ref);
  const ref = ResourceSlugUtils.build(component_account_name, component_name, resource_type, key, instance_name);
  return {
    name: key,
    metadata: {
      ...metadata,
      ref,
    },
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecCommand(spec.command),
    entrypoint: transformResourceSpecEntryPoint(spec.entrypoint),
    language: spec.language,
    environment: transformResourceSpecEnvironment(spec.environment),
    build: transformBuildSpec(spec.build, spec.image),
    cpu: spec.cpu,
    memory: spec.memory,
    depends_on: spec.depends_on || [],
    labels: spec.labels || new Map(),
    reserved_name: spec.reserved_name,
  };
};
