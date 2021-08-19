
/* eslint-disable no-empty */
import deepmerge from 'deepmerge';
import yaml from 'js-yaml';
import path from 'path';
import { tryReadFromPaths } from '../utils/files';
import NULL_TYPE from '../utils/yaml/null';
import { ComponentConfig } from './config/component-config';
import { validateOrRejectConfig } from './config/component-validator';
import { validateOrRejectSpec } from './spec-validator';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec } from './spec/transform/component-transform';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No component config file found at ${filepath}`;
  }
}

// a typing for the raw result of js-yaml.load();
export type ParsedYaml = object | string | number | null | undefined;

const specPaths = (input: string) => {
  return [
    input,
    path.join(input, 'architect.yml'),
    path.join(input, 'architect.yaml'),
  ];
};

export const loadSourceYmlFromPathOrReject = (spec_path: string): { source_path: string; source_yml: string } => {
  try {
    const try_files = specPaths(spec_path);
    const res = tryReadFromPaths(try_files);
    return {
      source_path: res.file_path,
      source_yml: res.file_contents,
    };
  } catch (err) {
    throw new MissingConfigFileError(spec_path);
  }
};

export const parseSourceYml = (source_yml: string): ParsedYaml => {
  const yaml_schema = {
    schema: yaml.JSON_SCHEMA.extend({ implicit: [NULL_TYPE] }),
  };
  return yaml.load(source_yml, yaml_schema);
};

export const dumpSpecToSourceYml = (spec: ComponentSpec): string => {
  return yaml.dump(spec);
};

export const buildSpecFromYml = (source_yml: string): ComponentSpec => {
  const parsed_yml = parseSourceYml(source_yml);
  return validateOrRejectSpec(parsed_yml);
};

export const buildSpecFromPath = (spec_path: string): { component_spec: ComponentSpec; source_path: string } => {
  const { source_path, source_yml } = loadSourceYmlFromPathOrReject(spec_path);

  return {
    component_spec: buildSpecFromYml(source_yml),
    source_path,
  };
};

export const buildConfigFromYml = (source_yml: string, tag: string): ComponentConfig => {
  const spec = buildSpecFromYml(source_yml);
  const config = transformComponentSpec(spec, source_yml, tag);
  validateOrRejectConfig(config);
  return config;
};

export const buildConfigFromObject = (config: Record<string, any>, tag: string): ComponentConfig => {
  const source_yaml = yaml.dump(config);
  return buildConfigFromYml(source_yaml, tag);
};

export const buildConfigFromPath = (spec_path: string, tag = 'latest'): { component_config: ComponentConfig; source_path: string } => {
  const { source_path, source_yml } = loadSourceYmlFromPathOrReject(spec_path);

  return {
    component_config: buildConfigFromYml(source_yml, tag),
    source_path,
  };
};

export const deepMergeSpecIntoComponent = (src: Partial<ComponentSpec>, target: ComponentConfig): ComponentConfig => {
  const spec = buildSpecFromYml(target.source_yml);
  const merged_yml = deepmerge(src, spec);
  const new_spec = validateOrRejectSpec(merged_yml);
  const merged_string = dumpSpecToSourceYml(merged_yml);

  return transformComponentSpec(new_spec, merged_string, target.tag);
};
