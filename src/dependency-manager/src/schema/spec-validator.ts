import Ajv from "ajv";
import { ParsedYaml } from './component-builder';
import * as schema from './spec/architect-schema.json';
import { ComponentSpec } from './spec/component-spec';

export const validateOrRejectSpec = (source_yml: ParsedYaml): ComponentSpec => {
  const ajv = new Ajv();
  const validate = ajv.compile(schema);
  const valid = validate(source_yml);
  if (!valid) {
    throw new Error(JSON.stringify(validate.errors));
  }

  return source_yml as ComponentSpec;

};
