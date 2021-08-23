import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
import { SchemaObject } from 'openapi3-ts';
import { REF_PREFIX } from '../utils/json-schema-annotations';
import { ComponentSpec } from './component-spec';
import { ResourceSpec } from './resource-spec';
import { ServiceSpec } from './service-spec';
import { TaskSpec } from './task-spec';

export const DEBUG_PREFIX = '_Debug';
const SCHEMA_TITLE = 'Architect.Yml Schema';
const SCHEMA_ID = 'https://raw.githubusercontent.com/architect-team/architect-cli/master/src/dependency-manager/schema/architect.schema.json';
const JSONSCHEMA_VERSION = 'http://json-schema.org/draft-07/schema';

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

    if (definition?.properties?.debug && (key === task_spec_name || key === service_spec_name)) {
      delete definition.properties.debug; // delete the debug property if it exists, a debug block is not valid inside a debug block
    }
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
 * we don't need the ResourceSpec in our definition.
 *
 * It used for a convenience inheritence pattern in Typescript,
 * but properties are all copied to ServiceSpec and TaskSpec in JSONSchema
 * so we don't need it in the final spec.
 */
const removeResourceSpec = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {
  delete definitions[ResourceSpec.name];
  delete definitions[`${DEBUG_PREFIX}}${ResourceSpec.name}`];
  return {
    ...definitions,
  };
};

/**
 * Strips all debug definitions out of the schema.
 */
export const stripDebugDefinitions = (schema: SchemaObject): SchemaObject => {
  const no_debug_definitions: { [key: string]: SchemaObject } = {};

  for (const [name, def] of Object.entries(schema.definitions)) {
    if (!name.includes(DEBUG_PREFIX)) {
      no_debug_definitions[name] = def as SchemaObject;
    }
  }

  return {
    ...schema,
    definitions: no_debug_definitions,
  };
};

/**
 * Adds `additionalProperties: false` to all objects which effectively bans all keys except those explictly referenced in the spec
 *
 * @param definitions
 * @returns
 */
const restrictAdditionalProperties = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {
  for (const definition of Object.values(definitions)) {
    if (!definition.additionalProperties) { // don't touch if definition already has set additionalProperties for its own purposes
      definition.additionalProperties = false;
      for (const property of Object.values(definition.properties || {}) as any[]) {
        if (!property.$ref && !property.additionalProperties && property.type === 'object') {
          property.additionalProperties = false;
        }
      }
    }
  }
  return {
    ...definitions,
  };
};

/**
 * Perform a little post-processing on the definitions
 */
const transformDefinitions = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {
  let transformed_definitions = restrictAdditionalProperties(definitions);
  transformed_definitions = removeResourceSpec(transformed_definitions);
  transformed_definitions = mergeDebugSpec(transformed_definitions);
  return {
    ...transformed_definitions,
  };
};

/**
 * Generates JSON Schema spec for the architect.yml
 * @returns
 */
const generateSpec = (): SchemaObject => {

  // importing this class into this file is required for the class-validator-jsonschema to pick this up. doesn't work by just referencing the tsconfig.json
  const _ = new ComponentSpec();

  const raw_definitions = validationMetadatasToSchemas({
    refPointerPrefix: REF_PREFIX,
  });

  const definitions = transformDefinitions(raw_definitions);

  // class-validator-jsonschema doesn't have an option to select the root reference, so we do it manually
  const root_schema = definitions[ComponentSpec.name];

  return {
    $id: SCHEMA_ID,
    title: SCHEMA_TITLE,
    $schema: JSONSCHEMA_VERSION,
    ...root_schema,
    definitions,
  };
};

// statically generate spec and expose as a constant
export const ARCHITECT_JSON_SCHEMA = generateSpec();
