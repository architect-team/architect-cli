import Ajv, { ErrorObject } from "ajv";
import ajv_errors from "ajv-errors";
import leven from 'leven';
import { Dictionary } from '../../utils/dictionary';
import { ValidationError, ValidationErrors } from '../../utils/errors';
import { buildContextMap, replaceBrackets } from '../../utils/interpolation';
import { ComponentSpec } from '../component-spec';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA, findDefinition } from './json-schema';

export type AjvError = ErrorObject[] | null | undefined;

export const findPotentialMatch = (value: string, options: string[], max_distance = 15): string | undefined => {
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

function escapeRegex(string: string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

export const addLineNumbers = (value: string, errors: ValidationError[]): void => {
  const rows = value.split('\n');
  const total_rows = rows.length;
  for (const error of errors) {
    const keys = error.path.split('.');
    const exp = new RegExp('(.*)?' + keys.map((key) => `${escapeRegex(key)}:`).join('(.*)?'), 's');
    const matches = exp.exec(value);
    if (matches) {
      const match = matches[0];
      const remaining_rows = value.replace(match, '').split('\n');
      const target_row = total_rows - remaining_rows.length;
      const end_row = rows[target_row];
      error.start = {
        row: target_row + 1,
        column: (end_row.length - end_row.trimLeft().length) + 1,
      };
      error.end = {
        row: target_row + 1,
        column: end_row.length - (remaining_rows[0]?.length || 0),
      };
    }
  }
};

export const mapAjvErrors = (parsed_yml: ParsedYaml, ajv_errors: AjvError): ValidationError[] => {
  if (!ajv_errors?.length) {
    return [];
  }

  // Expand ajv-errors errorMessage
  for (const ajv_error of ajv_errors.filter(e => e.keyword === 'errorMessage')) {
    for (const error of ajv_error.params.errors) {
      if (error.keyword === 'additionalProperties') {
        error.message = ajv_error.message;
        error.params.has_message = true;
        ajv_errors.push(error);
      }
    }
  }

  const ajv_error_map: Dictionary<ErrorObject> = {};
  for (const ajv_error of ajv_errors) {
    // Ignore noisy and redundant anyOf errors
    if (ajv_error.keyword === 'anyOf') {
      continue;
    }

    ajv_error.instancePath = ajv_error.instancePath.replace(/\//g, '.').replace('.', '');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const additional_property: string | undefined = ajv_error.params?.additionalProperty;
    if (additional_property) {
      if (!ajv_error.params.has_message) {
        ajv_error.message = `Invalid key: ${additional_property}`;

        const definition = findDefinition(replaceBrackets(ajv_error.instancePath), ARCHITECT_JSON_SCHEMA);
        if (definition) {
          const keys = Object.keys(definition.properties || {}).map((key) => ajv_error.instancePath ? `${ajv_error.instancePath}.${key}` : key);

          const potential_match = findPotentialMatch(`${ajv_error.instancePath}.${additional_property}`, keys);

          if (potential_match) {
            const match_keys = potential_match.split('.');
            ajv_error.message += ` - Did you mean ${match_keys[match_keys.length - 1]}?`;
          }
        }
      }

      ajv_error.instancePath += ajv_error.instancePath ? `.${additional_property}` : additional_property;
    }

    if (!ajv_error_map[ajv_error.instancePath]) {
      ajv_error_map[ajv_error.instancePath] = ajv_error;
    } else {
      ajv_error_map[ajv_error.instancePath].message += ` or ${ajv_error.message}`;
    }
  }

  // Filter error list to remove less specific errors
  const sorted_data_path_keys = Object.keys(ajv_error_map).sort(function (a, b) {
    return b.length - a.length;
  });
  const ignore_data_paths = new Set<string>();
  for (const data_path of sorted_data_path_keys) {
    const segments_list = data_path.split('.');
    const segments = segments_list.slice(0, segments_list.length - 1);
    let path = '';
    for (const segment of segments) {
      path += path ? `.${segment}` : segment;
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
      path: error.instancePath,
      message: error.message?.replace(/__arc__/g, '') || 'Unknown error',
      value: value === undefined ? '<unknown>' : value,
    }));
  }

  return errors;
};

export const validateSpec = (parsed_yml: ParsedYaml): ValidationError[] => {
  // TODO:288 enable strict mode?
  const ajv = new Ajv({ allErrors: true, unicodeRegExp: false });
  ajv.addKeyword('externalDocs');
  // https://github.com/ajv-validator/ajv-errors
  ajv_errors(ajv);
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
