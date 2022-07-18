import stringArgv from 'string-argv';
import { BuildConfig, ResourceConfig } from '../../config/resource-config';
import { Dictionary } from '../../utils/dictionary';
import { ComponentInstanceMetadata } from '../component-spec';
import { BuildSpec, EnvironmentSpecValue, ResourceSpec } from '../resource-spec';
import { ComponentSlugUtils, ResourceSlugUtils, ResourceType } from '../utils/slugs';

export const transformResourceSpecCommand = (command: string | string[] | undefined): string[] => {
  if (!command) return [];
  if (command instanceof Array) {
    return command;
  }
  return stringArgv(command);
};

export const transformResourceSpecEntryPoint = (entrypoint: string | string[] | undefined): string[] => {
  if (!entrypoint) return [];
  if (entrypoint instanceof Array) {
    return entrypoint;
  }
  return stringArgv(entrypoint);
};

export const transformResourceSpecEnvironment = (environment: Dictionary<EnvironmentSpecValue> | undefined): Dictionary<string | null> => {
  const output: Dictionary<string> = {};
  for (const [k, v] of Object.entries(environment || {})) {
    if (v === undefined || v === null) {
      continue;
    }

    if (v instanceof Object) {
      output[k] = JSON.stringify(v);
    } else {
      output[k] = `${v}`;
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

export const transformBuildSpec = (build: BuildSpec | undefined, image?: string): BuildConfig => {
  if (!build && !image) {
    build = {};
  } else if (!build) {
    return {};
  }
  return {
    context: build.context,
    args: transformBuildSpecArgs(build.args),
    dockerfile: build.dockerfile,
    target: build.target,
  };
};

export const transformResourceSpec = (resource_type: ResourceType, key: string, spec: ResourceSpec, metadata: ComponentInstanceMetadata): ResourceConfig => {
  const environment = transformResourceSpecEnvironment(spec.environment);
  const { component_account_name, component_name, instance_name } = ComponentSlugUtils.parse(metadata.ref);
  const architect_ref = ResourceSlugUtils.build(component_account_name, component_name, resource_type, key, instance_name);
  return {
    name: key,
    metadata: {
      ...metadata,
      ref: spec.reserved_name || architect_ref,
      architect_ref,
    },
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecCommand(spec.command),
    entrypoint: transformResourceSpecEntryPoint(spec.entrypoint),
    language: spec.language,
    environment,
    build: transformBuildSpec(spec.build, spec.image),
    cpu: spec.cpu,
    memory: spec.memory,
    depends_on: spec.depends_on || [],
    labels: spec.labels || new Map(),
    reserved_name: spec.reserved_name,
  };
};
