import { parse as shell_parse } from 'shell-quote';
import { ComponentInstanceMetadata } from '../../config/component-config';
import { BuildConfig, ResourceConfig, VolumeConfig } from '../../config/resource-config';
import { Dictionary, transformDictionary } from '../../utils/dictionary';
import { BuildSpec, EnvironmentSpecValue, ResourceSpec, VolumeSpec } from '../resource-spec';
import { ComponentSlugUtils, ServiceVersionSlugUtils } from '../utils/slugs';

export const transformResourceSpecName = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.service_name;
};

export const transformResourceSpecTag = (name: string | undefined): string => {
  const split = ServiceVersionSlugUtils.parse(name || '');
  return split.tag;
};

export const transformResourceSpecCommand = (command: string | string[] | undefined): string[] => {
  if (!command) return [];
  if (command instanceof Array) {
    return command;
  }
  return shell_parse(command.replace(/\$/g, '__arc__')).map(e => `${e}`.replace(/__arc__/g, '$'));
};

export const transformResourceSpecEntryPoint = (entrypoint: string | string[] | undefined): string[] => {
  if (!entrypoint) return [];
  if (entrypoint instanceof Array) {
    return entrypoint;
  }
  return shell_parse(entrypoint.replace(/\$/g, '__arc__')).map(e => `${e}`.replace(/__arc__/g, '$'));
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

export const transformResourceSpec = (key: string, spec: ResourceSpec, component_ref: string, tag: string, instance_metadata?: ComponentInstanceMetadata): ResourceConfig => {
  const environment = transformResourceSpecEnvironment(spec.environment);
  const { component_account_name, component_name } = ComponentSlugUtils.parse(component_ref);
  return {
    name: key,
    ref: ServiceVersionSlugUtils.build(component_account_name, component_name, key, tag, instance_metadata?.instance_name),
    tag,
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecCommand(spec.command),
    entrypoint: transformResourceSpecEntryPoint(spec.entrypoint),
    language: spec.language,
    debug: spec.debug ? transformResourceSpec(key, spec.debug, component_ref, tag) : undefined,
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
