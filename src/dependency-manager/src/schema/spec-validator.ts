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

  return errors;
};

export const validateSpec = (source_yml: ParsedYaml): ValidationError[] => {
  const ajv = new Ajv();
  const validate = ajv.compile(ARCHITECT_JSON_SCHEMA);
  const valid = validate(source_yml);
  if (!valid) {
    return mapAjvErrors(validate.errors);
  } else {
    return [];
  }
};

export const validateOrRejectSpec = (source_yml: ParsedYaml): ComponentSpec => {
  const errors = validateSpec(source_yml);
  if (errors && errors.length) {
    throw new Error(JSON.stringify(errors));
  }

  return source_yml as ComponentSpec;
};
