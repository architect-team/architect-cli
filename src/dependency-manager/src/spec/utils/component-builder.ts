
/* eslint-disable no-empty */
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { ComponentConfig } from '../../config/component-config';
import { ArchitectError, ValidationError, ValidationErrors } from '../../utils/errors';
import { replaceFileReference } from '../../utils/files';
import { ComponentSpec } from '../component-spec';
import { transformComponentSpec } from '../transform/component-transform';
import { validateOrRejectSpec } from './spec-validator';

// a typing for the raw result of js-yaml.load();
// eslint-disable-next-line @typescript-eslint/ban-types
export type ParsedYaml = object | string | number | null | undefined;

export const parseSourceYml = (source_yml: string): ParsedYaml => {
  return yaml.load(source_yml);
};

const getComponentFilePath = (spec_path: string): string => {
  let data;
  try {
    data = fs.lstatSync(spec_path);
  } catch {
    throw new ArchitectError(`Could not find architect.yml at ${spec_path}`);
  }

  if (data.isDirectory()) {
    if (fs.pathExistsSync(path.join(spec_path, 'architect.yml'))) {
      return path.join(spec_path, 'architect.yml');
    } else if (fs.pathExistsSync(path.join(spec_path, 'architect.yaml'))) {
      return path.join(spec_path, 'architect.yaml');
    } else {
      throw new ArchitectError(`Could not find architect.yml in directory at ${spec_path}`);
    }
  } else {
    return spec_path;
  }
};

export const loadSourceYmlFromPathOrReject = (spec_path: string): { source_path: string; source_yml: string; file_contents: string } => {
  const component_path = getComponentFilePath(spec_path);
  const file_contents = fs.readFileSync(component_path, 'utf-8');
  const parsed_yml = parseSourceYml(file_contents);
  const source_yml = replaceFileReference(parsed_yml, component_path);
  return {
    source_yml: source_yml,
    source_path: component_path,
    file_contents: file_contents,
  };
};

export const dumpToYml = (spec: any): string => {
  return yaml.dump(spec);
};

export const buildSpecFromYml = (source_yml: string): ComponentSpec => {
  const parsed_yml = parseSourceYml(source_yml);
  return validateOrRejectSpec(parsed_yml);
};

export const buildConfigFromYml = (source_yml: string): ComponentConfig => {
  const component_spec = buildSpecFromYml(source_yml);
  return transformComponentSpec(component_spec);
};

export const buildSpecFromPath = (spec_path: string): ComponentSpec => {
  const { source_path, source_yml, file_contents } = loadSourceYmlFromPathOrReject(spec_path);

  const file = {
    path: source_path,
    contents: file_contents,
  };

  try {
    const component_spec = buildSpecFromYml(source_yml);
    component_spec.metadata.file = file;
    return component_spec;
  } catch (err) {
    if (err instanceof ValidationErrors) {
      const errors = JSON.parse(err.message) as ValidationError[];
      throw new ValidationErrors(errors, file);
    }
    throw err;
  }
};

export const buildConfigFromPath = (spec_path: string): ComponentConfig => {
  const component_spec = buildSpecFromPath(spec_path);
  return transformComponentSpec(component_spec);
};
