import Ajv, { ErrorObject } from "ajv";
import leven from 'leven';
import { Dictionary } from '../utils/dictionary';
import { ValidationError, ValidationErrors } from '../utils/errors';
import { buildContextMap, replaceBrackets } from '../utils/interpolation';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';
import { ComponentSpec } from './spec/component-spec';

export type AjvError = ErrorObject[] | null | undefined;

export const findBestMatch = (value: string, options: string[], max_distance = 15): string | undefined => {
  let potential_match;
  let shortest_distance = Infinity;
  const value_length = value.length;
  for (const option of [...options].sort()) {
    const option_length = option.length;
    // https://github.com/sindresorhus/leven/issues/14
    if (Math.abs(value_length - option_length) >= max_distance) {
      continue;
    }

    const distance = leven(value, option);
    if (distance < max_distance && distance <= shortest_distance) {
      potential_match = option;
      shortest_distance = distance;
    }
  }
  return potential_match;
};

export const mapAjvErrors = (parsed_yml: ParsedYaml, ajv_errors: AjvError): ValidationError[] => {
  if (!ajv_errors?.length) {
    return [];
  }

  const ajv_error_map: Dictionary<Ajv.ErrorObject> = {};
  for (const ajv_error of ajv_errors) {
    if (!ajv_error_map[ajv_error.dataPath]) {
      // TODO:269 add test for additionalProperties
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      const additional_property: string | undefined = ajv_error.params?.additionalProperty;
      if (additional_property) {
        ajv_error.dataPath += `.${additional_property}`;
        // TODO:269 provide recommendations via leven?
        ajv_error.message = `${additional_property} is not a valid key - possible typo - check documentation`;
      }

      ajv_error_map[ajv_error.dataPath] = ajv_error;
    } else {
      ajv_error_map[ajv_error.dataPath].message += ` or ${ajv_error.message}`;
    }
  }

  // Filter error list to remove less specific errors
  const sorted_data_path_keys = Object.keys(ajv_error_map).sort(function (a, b) {
    return b.length - a.length;
  });
  const ignore_data_paths = new Set<string>();
  for (const data_path of sorted_data_path_keys) {
    const segments_list = data_path.split('.');
    const segments = segments_list.slice(1, segments_list.length - 1);
    let path = '';
    for (const segment of segments) {
      path += `.${segment}`;
      ignore_data_paths.add(path);
    }
  }

  const context_map = buildContextMap(parsed_yml);

  const errors: ValidationError[] = [];
  for (const [data_path, error] of Object.entries(ajv_error_map)) {
    if (ignore_data_paths.has(data_path)) {
      continue;
    }
    const normalized_path = replaceBrackets(data_path);
    let value = context_map[normalized_path?.startsWith('.') ? normalized_path.substr(1) : normalized_path];

    if (value instanceof Object && JSON.stringify(value).length > 1000) {
      value = '<truncated-object>';
    }

    errors.push(new ValidationError({
      path: error.dataPath.replace('.', ''), // Replace leading .
      message: error.message || 'Unknown error',
      value: value === undefined ? '<unknown>' : value,
    }));
  }

  return errors;
};

export const validateSpec = (parsed_yml: ParsedYaml): ValidationError[] => {
  const ajv = new Ajv();
  const validate = ajv.compile(ARCHITECT_JSON_SCHEMA);
  const valid = validate(parsed_yml);
  if (!valid) {
    return mapAjvErrors(parsed_yml, validate.errors);
  }
  return [];
};

export const validateOrRejectSpec = (parsed_yml: ParsedYaml): ComponentSpec => {
  const errors = validateSpec(parsed_yml);
  if (errors && errors.length) {
    throw new ValidationErrors(errors);
  }

  return parsed_yml as ComponentSpec;
};
