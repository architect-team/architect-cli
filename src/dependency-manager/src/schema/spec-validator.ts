import Ajv, { ErrorObject } from "ajv";
import { ParsedYaml } from './component-builder';
import * as schema from './spec/architect-schema.json';
import { ComponentSpec } from './spec/component-spec';

export const validateSpec = (source_yml: ParsedYaml): ErrorObject[] | null | undefined => {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(source_yml);
  if (!valid) {
    return validate.errors;
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

