import { parse as shell_parse } from 'shell-quote';
import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { ServiceVersionSlugUtils } from '../../../utils/slugs';
import { BuildConfig, ResourceConfig, VolumeConfig } from '../../config/resource-config';
import { BuildSpec, ResourceSpec, VolumeSpec } from '../resource-spec';

export const transformResourceSpecName = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.service_name;
};

export const transformResourceSpecTag = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.tag;
};

export const transformResourceSpecCommand = (command: string | string[] | undefined, environment: Dictionary<string>): string[] => {
  if (!command) return [];

  if (command instanceof Array) {
    return command;
  }

  const env: Dictionary<string> = {};
  for (const key of Object.keys(environment)) {
    env[key] = `$${key}`;
  }

  return shell_parse(command, env).map(e => `${e}`);
};

export const transformResourceSpecEntryPoint = (entrypoint: string | string[] | undefined, environment: Dictionary<string>): string[] => {
  if (!entrypoint) return [];
  if (entrypoint instanceof Array) {
    return entrypoint;
  }
  const env: Dictionary<string> = {};
  for (const key of Object.keys(environment)) {
    env[key] = `$${key}`;
  }
  return shell_parse(entrypoint, env).map(e => `${e}`);
};

export const transformResourceSpecEnvironment = (environment: Dictionary<string> | undefined): Dictionary<string> => {
  const output: Dictionary<string> = {};
  for (const [k, v] of Object.entries(environment || {})) {
    if (v === null) { continue; }
    output[k] = `${v}`;
  }
  return output;
};

export const transformBuildSpecArgs = (args?: Dictionary<string>): Dictionary<string> => {
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
    build = {
      context: '.',
    };
  } else if (!build) {
    return {};
  }
  return {
    context: build.context,
    args: transformBuildSpecArgs(build.args),
    dockerfile: build.dockerfile,
  };
};

export const transformVolumeSpec = (key: string, volume: VolumeSpec | string): VolumeConfig => {
  if (volume instanceof Object) {
    return {
      mount_path: volume.mount_path,
      host_path: volume.host_path,
      key: volume.key,
      description: volume.description,
      readonly: volume.readonly,
    };
  } else {
    return {
      host_path: volume,
    };
  }
};

export const transformResourceSpec = (key: string, spec: ResourceSpec): ResourceConfig => {
  const environment = transformResourceSpecEnvironment(spec.environment);

  return {
    name: transformResourceSpecName(spec.name),
    tag: transformResourceSpecTag(spec.name),
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecCommand(spec.command, environment),
    entrypoint: transformResourceSpecEntryPoint(spec.entrypoint, environment),
    language: spec.language,
    debug: spec.debug ? transformResourceSpec(key, spec.debug) : undefined,
    environment,
    volumes: transformDictionary(transformVolumeSpec, spec.volumes),
    build: transformBuildSpec(spec.build, spec.image),
    cpu: spec.cpu,
    memory: spec.memory,
    deploy: spec.deploy,
    depends_on: spec.depends_on || [],
    labels: spec.labels || new Map(),
  };
};
