import fs from 'fs-extra';
import yaml, { DumpOptions } from 'js-yaml';
import path from 'path';
import { ComponentConfig } from '../../config/component-config';
import { ArchitectError, ValidationError, ValidationErrors } from '../../utils/errors';
import { replaceFileReference } from '../../utils/files';
import { ParsedYaml } from '../../utils/types';
import { ComponentInstanceMetadata, ComponentSpec } from '../component-spec';
import { transformComponentSpec } from '../transform/component-transform';
import { validateOrRejectSpec } from './spec-validator';

export const parseSourceYml = (source_yml: string): ParsedYaml => {
  return yaml.load(source_yml);
};

const getComponentFilePath = (spec_path: string): string => {
  spec_path = path.resolve(spec_path);
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

export const loadFile = (path: string): string => {
  return fs.readFileSync(path, 'utf-8');
};

export const loadSourceYmlFromPathOrReject = (spec_path: string): { source_path: string; source_yml: string; file_contents: string } => {
  const component_path = getComponentFilePath(spec_path);
  const file_contents = loadFile(component_path);
  const parsed_yml = parseSourceYml(file_contents);
  const source_yml = replaceFileReference(parsed_yml, component_path);
  return {
    source_yml: source_yml,
    source_path: component_path,
    file_contents: file_contents,
  };
};

export const dumpToYml = (spec: any, options: DumpOptions = {}): string => {
  return yaml.dump(spec, options);
};

export const buildSpecFromYml = (source_yml: string, metadata?: ComponentInstanceMetadata): ComponentSpec => {
  const parsed_yml = parseSourceYml(source_yml);
  const spec = validateOrRejectSpec(parsed_yml, metadata);
  if (!metadata?.file) {
    spec.metadata.file = { contents: source_yml, path: '', folder: '' };
  }
  return spec;
};

export const buildConfigFromYml = (source_yml: string, metadata?: ComponentInstanceMetadata): ComponentConfig => {
  const component_spec = buildSpecFromYml(source_yml, metadata);
  return transformComponentSpec(component_spec);
};

export const buildSpecFromPath = (spec_path: string, metadata?: ComponentInstanceMetadata): ComponentSpec => {
  const { source_path, source_yml, file_contents } = loadSourceYmlFromPathOrReject(spec_path);

  const file = {
    path: source_path,
    folder: fs.lstatSync(source_path).isFile() ? path.dirname(source_path) : source_path,
    contents: file_contents,
  };

  try {
    const component_spec = buildSpecFromYml(source_yml, metadata);
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

export const buildConfigFromPath = (spec_path: string, metadata?: ComponentInstanceMetadata): ComponentConfig => {
  const component_spec = buildSpecFromPath(spec_path, metadata);
  return transformComponentSpec(component_spec);
};
