
/* eslint-disable no-empty */
import chalk from 'chalk';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { ValidationErrors } from '../..';
import { ComponentConfig } from '../../config/component-config';
import { validateOrRejectConfig } from '../../config/component-validator';
import { Dictionary } from '../../utils/dictionary';
import { ArchitectError, ValidationError } from '../../utils/errors';
import { replaceFileReference } from '../../utils/files';
import { ComponentSpec } from '../component-spec';
import { transformComponentSpec } from '../transform/component-transform';
import { addLineNumbers, validateOrRejectSpec } from './spec-validator';

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

const _buildConfigFromYml = (source_yml: string, tag: string): { component_config: ComponentConfig; component_spec: ComponentSpec; } => {
  const component_spec = buildSpecFromYml(source_yml);
  const component_config = transformComponentSpec(component_spec, source_yml, tag);
  validateOrRejectConfig(component_config);
  return { component_config, component_spec };
};

export const buildConfigFromYml = (source_yml: string, tag: string): ComponentConfig => {
  const { component_config } = _buildConfigFromYml(source_yml, tag);
  return component_config;
};

export const buildConfigFromObject = (config: Record<string, any>, tag: string): ComponentConfig => {
  const source_yaml = yaml.dump(config);
  return buildConfigFromYml(source_yaml, tag);
};

const prettyValidationErrors = (source_yml: string, errors: ValidationError[]) => {
  const errors_row_map: Dictionary<ValidationError> = {};
  let min_row = Infinity;
  let max_row = -Infinity;
  for (const error of errors) {
    if (error.start && error.end) {
      // TODO handle multiple errors on one row?
      errors_row_map[error.start.row] = error;
      if (error.start.row < min_row) {
        min_row = error.start.row;
      }
      if (error.start.row > max_row) {
        max_row = error.start.row;
      }
    }
  }
  // TODO don't show pretty errors if some errors dont have line #s?

  min_row = Math.max(min_row - 4, 0);
  max_row = max_row + 3;

  const res = [];
  let line_number = min_row + 1;
  const lines = source_yml.split('\n').slice(min_row, max_row);
  const lines_length = lines.length;
  const max_number_length = `${min_row + lines_length}`.length;
  for (const line of lines) {
    const error = errors_row_map[line_number];

    const line_number_space = (max_number_length - `${line_number}`.length);

    let number_line = error ? chalk.red('›') + ' ' : '  ';
    number_line += chalk.gray(`${' '.repeat(line_number_space)}${line_number} | `);
    number_line += chalk.cyan(line);
    res.push(number_line);

    if (error?.start && error?.end) {
      let error_line = chalk.gray(`${' '.repeat(max_number_length + 2)} | `);
      error_line += ' '.repeat(error.start.column - 1);
      error_line += chalk.red('﹋'.repeat(((error.end.column - error.start.column) + 1) / 2));
      error_line += ' ';
      error_line += chalk.red(error.message);
      res.push(error_line);
    }

    line_number += 1;
  }

  console.log(res.join('\n'));
};

export const buildConfigFromPath = (spec_path: string, tag = 'latest'): { component_config: ComponentConfig; component_spec: ComponentSpec; source_path: string } => {
  const { source_path, source_yml, file_contents } = loadSourceYmlFromPathOrReject(spec_path);
  try {
    const { component_config, component_spec } = _buildConfigFromYml(source_yml, tag);
    return {
      component_spec,
      component_config,
      source_path,
    };
  } catch (err) {
    err.name = `${err.name || 'Error'}\nfile: ${source_path}`;
    try {
      err.name += `\ncomponent: ${(yaml.load(source_yml) as any).name}`;
    } catch { }
    if (err instanceof ValidationErrors) {
      const errors = JSON.parse(err.message) as ValidationError[];

      addLineNumbers(file_contents, errors);
      prettyValidationErrors(file_contents, errors);

      const error = new ValidationErrors(errors);
      error.name = err.name;
      throw error;
    }
    throw err;
  }
};
