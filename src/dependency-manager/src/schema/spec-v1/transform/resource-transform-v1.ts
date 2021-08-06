import { parse as shell_parse } from 'shell-quote';
import { Dictionary, transformDictionary } from '../../../utils/dictionary';
import { ServiceVersionSlugUtils } from '../../../utils/slugs';
import { BuildConfig, ResourceConfig, VolumeConfig } from '../../config/resource-config';
import { BuildSpecV1, ResourceSpecV1, VolumeSpecV1 } from '../resource-spec-v1';

export const transformResourceSpecV1Name = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.service_name;
};

export const transformResourceSpecV1Tag = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.tag;
};

export const transformResourceSpecV1Command = (command: string | string[] | undefined, environment: Dictionary<string>): string[] => {
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

export const transformResourceSpecV1EntryPoint = (entrypoint: string | string[] | undefined, environment: Dictionary<string>): string[] => {
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

export const transformResourceSpecV1Environment = (environment: Dictionary<string> | undefined): Dictionary<string> => {
  const output: Dictionary<string> = {};
  for (const [k, v] of Object.entries(environment || {})) {
    if (v === null) { continue; }
    output[k] = `${v}`;
  }
  return output;
};

export const transformBuildSpecV1Args = (args?: Dictionary<string>): Dictionary<string> => {
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

export const transformBuildSpecV1 = (build: BuildSpecV1 | undefined, image?: string): BuildConfig => {
  if (!build && !image) {
    build = {
      context: '.',
    };
  } else if (!build) {
    return {};
  }
  return {
    context: build.context,
    args: transformBuildSpecV1Args(build.args),
    dockerfile: build.dockerfile,
  };
};

export const transformVolumeSpecV1 = (key: string, volume: VolumeSpecV1 | string): VolumeConfig => {
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

export const transformResourceSpecV1 = (key: string, spec: ResourceSpecV1): ResourceConfig => {
  const environment = transformResourceSpecV1Environment(spec.environment);

  return {
    name: transformResourceSpecV1Name(spec.name),
    tag: transformResourceSpecV1Tag(spec.name),
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecV1Command(spec.command, environment),
    entrypoint: transformResourceSpecV1EntryPoint(spec.entrypoint, environment),
    language: spec.language,
    debug: spec.debug ? transformResourceSpecV1(key, spec.debug) : undefined,
    environment,
    volumes: transformDictionary(transformVolumeSpecV1, spec.volumes),
    build: transformBuildSpecV1(spec.build, spec.image),
    cpu: spec.cpu,
    memory: spec.memory,
    deploy: spec.deploy,
    depends_on: spec.depends_on || [],
    labels: spec.labels || new Map(),
  };
};

  // TODO:269: where does expand fit in?
  // /** @return New expanded copy of the current config */
  // expand() {
  //   const config = this.copy();

  //   const debug = config.getDebugOptions();
  //   if (debug) {
  //     config.setDebugOptions(debug.expand());
  //   }
  //   for (const [key, value] of Object.entries(this.getVolumes())) {
  //     config.setVolume(key, value);
  //   }
  //   return config;
  // }
