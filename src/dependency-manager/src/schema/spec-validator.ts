import Ajv, { ErrorObject } from "ajv";
import betterAjvErrors from 'better-ajv-errors';
import { ValidationError } from '../utils/errors';
import { ParsedYaml } from './component-builder';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';
import { ComponentSpec } from './spec/component-spec';

export type AjvError = ErrorObject[] | null | undefined;

export const mapAjvErrors = (errors: betterAjvErrors.IOutputError[]): ValidationError[] => {
  if (!errors?.length) {
    return [];
  }

  return errors;
};

export const validateSpec = (parsed_yml: ParsedYaml): ValidationError[] => {
  const ajv = new Ajv({ jsonPointers: true });
  const validate = ajv.compile(ARCHITECT_JSON_SCHEMA);
  const valid = validate(parsed_yml);
  if (!valid) {
    const output = betterAjvErrors(ARCHITECT_JSON_SCHEMA, parsed_yml, validate.errors, { format: 'js' });
    console.log('output:');
    console.log(JSON.stringify(output));
    if (output) {
      return mapAjvErrors(output);
    }
  }
  return [];
};

export const validateOrRejectSpec = (parsed_yml: ParsedYaml): ComponentSpec => {
  const errors = validateSpec(parsed_yml);
  if (errors && errors.length) {
    throw new Error(JSON.stringify(errors));
  }

  return parsed_yml as ComponentSpec;
};
