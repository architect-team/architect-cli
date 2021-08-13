import Ajv, { ErrorObject } from "ajv";
import { Dictionary } from '../utils/dictionary';
import { ValidationError } from '../utils/errors';
import { buildContextMap } from '../utils/interpolation';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';
import { ComponentSpec } from './spec/component-spec';

export type AjvError = ErrorObject[] | null | undefined;

export const mapAjvErrors = (parsed_yml: ParsedYaml, ajv_errors: AjvError): ValidationError[] => {
  if (!ajv_errors?.length) {
    return [];
  }

  const ajv_error_map: Dictionary<string[]> = {};
  for (const ajv_error of ajv_errors) {
    if (!ajv_error_map[ajv_error.dataPath]) {
      ajv_error_map[ajv_error.dataPath] = [];
    }
    ajv_error_map[ajv_error.dataPath].push(ajv_error.message || 'unknown');
  }

  const context_map = buildContextMap(parsed_yml);

  const errors: ValidationError[] = [];
  for (const [data_path, messages] of Object.entries(ajv_error_map)) {
    const value = context_map[data_path?.startsWith('.') ? data_path.substr(1) : data_path];
    errors.push({
      dataPath: data_path,
      message: messages.join(' or '),
      value: value === undefined ? '<unknown>' : value,
    });
  }

  // TODO:269: map errors

  return errors;
};

export const validateSpec = (parsed_yml: ParsedYaml): ValidationError[] => {
  const ajv = new Ajv(); // TODO:269: upgrade ajv to 8.*
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
    throw new Error(JSON.stringify(errors, null, 2));
  }

  return parsed_yml as ComponentSpec;
};
