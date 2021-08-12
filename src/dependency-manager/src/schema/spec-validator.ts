import Ajv, { ErrorObject } from "ajv";
import { Dictionary } from '../utils/dictionary';
import { ValidationError } from '../utils/errors';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';
import { ComponentSpec } from './spec/component-spec';

export type AjvError = ErrorObject[] | null | undefined;

function getVal(path: string[], obj: any): any {
  if (path[0] === '') {
    path.shift();
  }
  if (obj === undefined) {
    return '<unknown>';
  }
  if (path.length === 1) {
    return obj[path[0]];
  }
  else {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    return getVal(path, obj[path.shift()!]);
  }
}

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

  // TODO:269 make replaceBrackets more generic and add new method replaceInterpolationBrackets
  function replaceBracketsTmp(value: string) {
    return value.replace(/\[["|']?([^\]|"|']+)["|']?\]/g, '.$1');
  }

  const errors: ValidationError[] = [];
  for (const [data_path, messages] of Object.entries(ajv_error_map)) {
    errors.push({
      dataPath: data_path,
      message: messages.join(' or '),
      value: getVal(replaceBracketsTmp(data_path).split('.'), parsed_yml),
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
    console.error('failed spec:'); //TODO:269
    console.error(JSON.stringify(parsed_yml, null, 2));
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
