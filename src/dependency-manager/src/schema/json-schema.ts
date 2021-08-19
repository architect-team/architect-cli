import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { SchemaObject } from 'openapi3-ts';
import { REF_PREFIX } from './json-schema-annotations';
import { ComponentSpec } from './spec/component-spec';
import { ResourceSpec } from './spec/resource-spec';
import { ServiceSpec } from './spec/service-spec';
import { TaskSpec } from './spec/task-spec';

const DEBUG_PREFIX = '_Debug';

/**
 * Recursively searches an object for all keys named `$ref` and splices in `_Debug` to each definition ref.
 * This is required because we manually modify the Debug schema in mergeDebugSpec
 *
 * @param obj
 */
const recursivelyReplaceDebugRefs = (obj: SchemaObject) => {
  Object.keys(obj).forEach((k) => {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (k === '$ref') {
      obj[k] = `${REF_PREFIX}${DEBUG_PREFIX}${obj[k].replace(REF_PREFIX, '')}`;
    }

    recursivelyReplaceDebugRefs(obj[k]);
  });
};

/**
 * Modifies the set of generated definitions to add the Debug Spec. This is necessary because the debug spec is
 * slightly divergent from the actual spec. We can use Partial<Spec> in typescript, but we have no such control
 * in JSON schema or the class-validator-jsonschema generator.
 *
 * @param definitions
 * @returns
 */
const mergeDebugSpec = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {

  const resource_spec_name = ResourceSpec.name;
  const service_spec_name = ServiceSpec.name;
  const task_spec_name = TaskSpec.name;
  const debug_field = 'debug';

  const definitions_copy = JSON.parse(JSON.stringify(definitions)) as Record<string, SchemaObject>;
  const debug_definitions: Record<string, SchemaObject> = {};
  for (const [key, definition] of Object.entries(definitions_copy)) {
    delete definition.required;
    delete definition.oneOf;
    delete definition.anyOf;
    delete definition.none;
    delete definition.allOf;
    debug_definitions[`${DEBUG_PREFIX}${key}`] = definition;

    if (definition?.properties?.debug && (key === resource_spec_name || key === task_spec_name || key === service_spec_name)) {
      delete definition.properties.debug; // delete the debug property if it exists, a debug block is not valid inside a debug block
    }
  }

  if (definitions[resource_spec_name]?.properties) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    definitions[resource_spec_name].properties![debug_field].$ref = `${REF_PREFIX}${DEBUG_PREFIX}${resource_spec_name}`;
  } else {
    throw new Error(`The Spec has been modified in a way such that the debug block is no longer being added to ${resource_spec_name}!`);
  }

  if (definitions[service_spec_name]?.properties) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    definitions[service_spec_name].properties![debug_field].$ref = `${REF_PREFIX}${DEBUG_PREFIX}${service_spec_name}`;
  } else {
    throw new Error(`The Spec has been modified in a way such that the debug block is no longer being added to ${service_spec_name}!`);
  }

  if (definitions[task_spec_name]?.properties) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    definitions[task_spec_name].properties![debug_field].$ref = `${REF_PREFIX}${DEBUG_PREFIX}${task_spec_name}`;
  } else {
    throw new Error(`The Spec has been modified in a way such that the debug block is no longer being added to ${task_spec_name}!`);
  }

  recursivelyReplaceDebugRefs(debug_definitions);

  return {
    ...definitions,
    ...debug_definitions,
  };
};

/**
 * Generates JSON Schema spec for the architect.yml
 * @returns
 */
const generateSpec = (): SchemaObject => {

  // importing this class into this file is required for the class-validator-jsonschema to pick this up. doesn't work by just referencing the tsconfig.json
  const component_spec = new ComponentSpec();

  const raw_definitions = validationMetadatasToSchemas({
    refPointerPrefix: REF_PREFIX,
  });

  // we need to do a little bit of manual manipulation to add the debug spec
  const definitions = mergeDebugSpec(raw_definitions);

  // class-validator-jsonschema doesn't have an option to select the root reference, so we do it manually
  const root_schema = definitions['ComponentSpec'];

  return {
    title: "JSON Schema for Architect.io configuration",
    $schema: "http://json-schema.org/draft-07/schema",
    ...root_schema,
    definitions,
  };
};

// statically generate spec and expose as a constant
export const ARCHITECT_JSON_SCHEMA = generateSpec();
