import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { REF_PREFIX } from './json-schema-annotations';
import { ComponentSpec } from './spec/component-spec';

// importing this class into this file is required for the class-validator-jsonschema to pick this up. doesn't work by just referencing the tsconfig.json
const component_spec = new ComponentSpec();

const definitions = validationMetadatasToSchemas({
  refPointerPrefix: REF_PREFIX,
});

// class-validator-jsonschema doesn't have an option to select the root reference, so we do it manually
const root_schema = definitions['ComponentSpec'];

export const ARCHITECT_JSON_SCHEMA = {
  title: "JSON Schema for Architect.io configuration",
  $schema: "http://json-schema.org/draft-07/schema",
  ...root_schema,
  definitions,
};
