import { validationMetadatasToSchemas } from 'class-validator-jsonschema';
// eslint-disable-next-line node/no-extraneous-import
import type { SchemaObject } from 'openapi3-ts';
import { Dictionary } from '../../utils/dictionary';
import { ComponentSpec } from '../component-spec';
import { ResourceSpec } from '../resource-spec';
import { ServiceSpec } from '../service-spec';
import { TaskSpec } from '../task-spec';
import { IF_EXPRESSION_REGEX } from './interpolation';
import { REF_PREFIX } from './json-schema-annotations';

const SCHEMA_ID = 'https://raw.githubusercontent.com/architect-team/architect-cli/main/src/dependency-manager/schema/architect.schema.json';
const JSONSCHEMA_VERSION = 'http://json-schema.org/draft-07/schema';
const DOCS_URL = 'https://docs.architect.io/reference/architect-yml';
const SCHEMA_TITLE = `Schema for architect.yml. See: ${DOCS_URL}`;

export const DEBUG_PREFIX = '_Debug';

/**
 * Given a spec, returns the path to the docs where the spec is defined
 */
export const getDocsPath = (spec_name: string): string => {
  return `#${spec_name.toLowerCase()}`;
};

// Find a schema definition given a pointer ex. services.api.interfaces -> ServiceInterfaceSpec
export const findDefinition = (pointer: string, schema: SchemaObject): SchemaObject | undefined => {
  if (pointer === '') {
    return schema;
  }
  const keys = pointer.split('.');

  let definition: Dictionary<SchemaObject> = schema;
  let skip_key = false;
  for (const key of keys) {
    if (skip_key) {
      skip_key = false;
      continue;
    }
    const property = definition.properties[key] as SchemaObject;

    if (!property) {
      return;
    }

    const additional_properties = property.additionalProperties as SchemaObject;
    if (property.$ref) {
      definition = schema.definitions[property.$ref.replace(REF_PREFIX, '')];
    } else if (additional_properties?.anyOf) {
      for (const x of additional_properties.anyOf) {
        if (x.$ref) {
          definition = schema.definitions[x.$ref.replace(REF_PREFIX, '')];
          skip_key = true;
          break;
        }
      }
    } else if (property.patternProperties) {
      for (const pattern_property of Object.values(property.patternProperties)) {
        const anyOf = (pattern_property as SchemaObject)!.anyOf || [];
        for (const x of anyOf) {
          if (x.$ref) {
            definition = schema.definitions[x.$ref.replace(REF_PREFIX, '')];
            skip_key = true;
            break;
          }
        }
      }
    }
  }

  return definition;
};

/**
 * Recursively searches an object for all keys named `$ref` and splices in `_Debug` to each definition ref.
 * This is required because we manually modify the Debug schema in mergeDebugSpec
 *
 * @param obj
 */
const recursivelyReplaceDebugRefs = (obj: SchemaObject) => {
  for (const k of Object.keys(obj)) {
    if (!obj || typeof obj !== 'object') {
      return;
    }

    if (k === '$ref') {
      obj[k] = `${REF_PREFIX}${DEBUG_PREFIX}${obj[k].replace(REF_PREFIX, '')}`;
    }

    recursivelyReplaceDebugRefs(obj[k]);
  }
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
    definitions[service_spec_name].properties![debug_field].$ref = `${REF_PREFIX}${DEBUG_PREFIX}${service_spec_name}`;
  } else {
    throw new Error(`The Spec has been modified in a way such that the debug block is no longer being added to ${service_spec_name}!`);
  }

  if (definitions[task_spec_name]?.properties) {
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
 * Adds links to our remote docs
 */
const addDocsLinks = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {
  for (const [name, definition] of Object.entries(definitions)) {
    if (!definition.externalDocs) { // don't touch if definition already has set externalDocs for its own purposes
      definition.externalDocs = {
        url: `${DOCS_URL}${getDocsPath(name)}`,
      };
    }
  }
  return {
    ...definitions,
  };
};

/**
 * Add support for template expressions like ${{ if eq(secrets.environment, dev) }}:
 */
const addExpressions = (definitions: Record<string, SchemaObject>): Record<string, SchemaObject> => {
  for (const [definition_name, definition] of Object.entries(definitions)) {
    // Don't allow if statements in parameters/secrets
    if (definition_name === 'SecretDefinitionSpec') {
      continue;
    }
    for (const [property_name, property] of Object.entries(definition.properties || {}) as [string, SchemaObject][]) {
      // Don't allow if statements in parameters or dependencies block
      if (property_name === 'parameters' || property_name === 'secrets' || property_name === 'dependencies') {
        continue;
      }

      if (property.type === 'object') {
        if (!property.patternProperties) {
          property.patternProperties = {};
        }
        property.patternProperties[IF_EXPRESSION_REGEX.source] = {
          anyOf: [
            JSON.parse(JSON.stringify(property)),
          ],
        };
      }
    }
    if (!definition.patternProperties) {
      definition.patternProperties = {};
    }
    definition.patternProperties[IF_EXPRESSION_REGEX.source] = {
      anyOf: [
        JSON.parse(JSON.stringify(definition)),
      ],
    };
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
  transformed_definitions = restrictAdditionalProperties(transformed_definitions);
  transformed_definitions = removeResourceSpec(transformed_definitions);
  transformed_definitions = addDocsLinks(transformed_definitions);
  transformed_definitions = mergeDebugSpec(transformed_definitions);
  transformed_definitions = addExpressions(transformed_definitions);
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

let _cached_schema: SchemaObject;
export const getArchitectJSONSchema = (): SchemaObject => {
  if (!_cached_schema) {
    _cached_schema = generateSpec();
  }
  return _cached_schema;
};
