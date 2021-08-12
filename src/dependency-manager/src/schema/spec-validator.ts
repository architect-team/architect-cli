import Ajv, { ErrorObject } from "ajv";
import { ValidationError } from '../utils/errors';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';
import { ComponentSpec } from './spec/component-spec';

export type AjvError = ErrorObject[] | null | undefined;

export const mapAjvErrors = (errors: AjvError): ValidationError[] => {
  if (!errors?.length) {
    return [];
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
    return mapAjvErrors(validate.errors);
  }
  return [];
};

export const validateOrRejectSpec = (parsed_yml: ParsedYaml): ComponentSpec => {
  const errors = validateSpec(parsed_yml);
  if (errors && errors.length) {
    console.error('failed spec:'); //TODO:269
    console.error(JSON.stringify(parsed_yml, null, 2));
    throw new Error(JSON.stringify(errors));
  }

  return parsed_yml as ComponentSpec;
};
