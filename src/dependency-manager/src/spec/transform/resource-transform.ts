import { parse as shell_parse } from 'shell-quote';
import { BuildConfig, ResourceConfig } from '../../config/resource-config';
import { Dictionary } from '../../utils/dictionary';
import { ComponentInstanceMetadata } from '../component-spec';
import { BuildSpec, EnvironmentSpecValue, ResourceSpec } from '../resource-spec';
import { ComponentVersionSlugUtils, ResourceVersionSlugUtils } from '../utils/slugs';

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
    target: build.target,
  };
};

export const transformResourceSpec = (key: string, spec: ResourceSpec, metadata: ComponentInstanceMetadata): ResourceConfig => {
  const environment = transformResourceSpecEnvironment(spec.environment);
  const { component_account_name, component_name } = ComponentVersionSlugUtils.parse(metadata.ref);
  return {
    name: key,
    ref: ResourceVersionSlugUtils.build(component_account_name, component_name, key, metadata.tag, metadata?.instance_name),
    tag: metadata.tag,
    description: spec.description,
    image: spec.image,
    command: transformResourceSpecCommand(spec.command),
    entrypoint: transformResourceSpecEntryPoint(spec.entrypoint),
    language: spec.language,
    environment,
    build: transformBuildSpec(spec.build, spec.image),
    cpu: spec.cpu,
    memory: spec.memory,
    deploy: spec.deploy,
    depends_on: spec.depends_on || [],
    labels: spec.labels || new Map(),
  };
};
