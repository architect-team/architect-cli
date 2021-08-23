import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { DEBUG_PREFIX, getDocsPath, stripDebugDefinitions } from '../spec/json-schema';
import { REF_PREFIX } from './json-schema-annotations';

const OPEN = '&lt;';
const CLOSE = '&gt;';
const OR = ' \\| ';

const propertyRefToMarkdown = (property: ReferenceObject): string => {
  const type = property.$ref.replace(REF_PREFIX, '').replace(DEBUG_PREFIX, '');
  const path = getDocsPath(type);
  const link = `[${type}](${path})`;

  // if the property ref includes the Debug prefix, make it a partial
  if (property.$ref.includes(DEBUG_PREFIX)) {
    return `Partial${OPEN}${link}${CLOSE}`;
  } else {
    return link;
  }
};

const arrayTypeToMarkdown = (property: SchemaObject): string => {
  if ((property?.items as SchemaObject)?.anyOf?.length) {
    const anyOf = ((property?.items as SchemaObject)?.anyOf as SchemaObject);
    const types = anyOf?.map((a: SchemaObject) => a.type).join(OR);
    return `Array${OPEN}${types}${CLOSE}`;
  } else if ((property?.items as SchemaObject)?.type) {
    const type = (property?.items as SchemaObject)?.type;
    return `Array${OPEN}${type}${CLOSE}`;
  } else {
    return '';
  }
};

const additionalPropertiesTypeToMarkdown = (property: SchemaObject): string => {
  const additional_props = property?.additionalProperties as SchemaObject;
  if (additional_props?.anyOf?.length) {
    const types: string[] = [];
    for (const prop of additional_props.anyOf) {
      if (prop.$ref) {
        types.push(propertyRefToMarkdown(prop as ReferenceObject));
      } else if ((prop as SchemaObject)?.type === 'array') {
        types.push(arrayTypeToMarkdown(prop));
      } else if ((prop as SchemaObject)?.type) {
        const primitive = (prop as SchemaObject).type as string;
        types.push(primitive);
      }
    }

    return `Dict${OPEN}${types.join(OR)}${CLOSE}`;
  } else {
    return '';
  }
};

const anyOfPropertyTypeToMarkdown = (property: SchemaObject): string => {
  if (property?.anyOf?.length) {
    const types: string[] = [];
    for (const prop of property.anyOf) {
      if (prop.$ref) {
        types.push(propertyRefToMarkdown(prop as ReferenceObject));
      } else if ((prop as SchemaObject)?.type === 'array') {
        types.push(arrayTypeToMarkdown(prop));
      } else if ((prop as SchemaObject)?.type) {
        const primitive = (prop as SchemaObject).type as string;
        types.push(primitive);
      }
    }

    return `${types.join(OR)}`;
  }
  return ``;
};

const propertyTypeToMarkdown = (prop_body: SchemaObject | ReferenceObject): string => {
  let markdown = ``;
  if (prop_body.$ref) {
    const property = prop_body as ReferenceObject;
  } else {
    const property = prop_body as SchemaObject;

    if (property.type === 'array') {
      markdown += arrayTypeToMarkdown(prop_body);
    } else if (property.additionalProperties) {
      markdown += additionalPropertiesTypeToMarkdown(prop_body);
    } else if ((prop_body as SchemaObject)?.anyOf) {
      markdown += anyOfPropertyTypeToMarkdown(prop_body);
    } else if ((prop_body as SchemaObject)?.type) {
      markdown += `${(prop_body as SchemaObject).type}`;
    }
  }

  return markdown;
};

const patternPropertyToMarkdown = (): string => {
  return `Dict${OPEN}string${CLOSE}`;
};

const strikethrough = (value: string): string => {
  return `~~${value}~~`;
};

const propertyToMarkdown = (prop_name: string, prop_body: SchemaObject | ReferenceObject, required: boolean): string => {
  let markdown = `|`;

  const property = `\`${prop_name}\`${required ? '*' : ''}`;
  const deprecated = (prop_body as SchemaObject)?.deprecated;

  markdown += `${deprecated ? strikethrough(property) : property}`;
  markdown += ` | `;

  if (prop_body.$ref) {
    markdown += `${propertyRefToMarkdown(prop_body as ReferenceObject)}`;
  } else if ((prop_body as SchemaObject)?.patternProperties && (prop_body as SchemaObject)?.type === 'object') {
    markdown += `${patternPropertyToMarkdown()}`;
  } else {
    markdown += `${propertyTypeToMarkdown(prop_body)}`;
  }

  markdown += ` | `;

  if ((prop_body as SchemaObject).description) {
    markdown += `${(prop_body as SchemaObject).description}`;
  }
  // else {
  //   throw new Error('Spec fields should all be annotated with a `description` for the docs.');
  // }
  markdown += ` | `;

  if ((prop_body as SchemaObject)?.pattern) {
    const pattern = (prop_body as SchemaObject).pattern as string;
    markdown += `Must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(pattern)}">Regex</a>`;
  } else if ((prop_body as SchemaObject)?.patternProperties) {
    for (const [key, value] of Object.entries((prop_body as SchemaObject)?.patternProperties)) {
      markdown += `Key must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(key)}">Regex</a>`;
      markdown += `Value must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent((value as any).pattern)}">Regex</a>`;
    }
  } else if ((prop_body as SchemaObject)?.deprecated) {
    markdown += ' Deprecated ';
  }

  markdown += ` | `;

  return markdown;
};

const schemaToMarkdown = (schema: SchemaObject): string => {
  let markdown = '';

  const no_debug_schema = stripDebugDefinitions(schema);

  // re-order the keys in the map to provide more natural ordering in the docs
  const ordered_definitions: { [key: string]: SchemaObject } = {
    ComponentSpec: no_debug_schema.definitions['ComponentSpec'],
    ServiceSpec: no_debug_schema.definitions['ServiceSpec'],
    TaskSpec: no_debug_schema.definitions['TaskSpec'],
    ComponentInterfaceSpec: no_debug_schema.definitions['ComponentInterfaceSpec'],
    ParameterDefinitionSpec: no_debug_schema.definitions['ParameterDefinitionSpec'],
    ...no_debug_schema.definitions,
  };

  for (const [spec_name, definition] of Object.entries(ordered_definitions)) {
    markdown += `## ${spec_name}\n\n`;

    if (definition.description) {
      markdown += `${definition.description}\n\n`;
    }
    // else {
    //   throw new Error('Spec classes should all be annotated with a `description` for the docs.');
    // }

    markdown += `| Field  (*=required)  | Type       | Description    | Misc           |\n`;
    markdown += `| -------------------- | ---------- | -------------- | -------------- |\n`;

    if (definition?.properties) {
      for (const [prop_name, prop_body] of Object.entries(definition.properties)) {
        const required = !!definition.required && definition.required.includes(prop_name);
        markdown += `${propertyToMarkdown(prop_name, prop_body, required)}\n`;
      }
    }

    markdown += `\n\n`;
  }

  return markdown;
};

/**
 * Generates a markdown string using the JSONSchema of our architect spec.
 *
 * Note that this was not written as some generalized "JSONSchema to Markdown" transformer and is pretty particular to the way
 * we do things. If the way we generate our JSONSchema changes too drastically, we'll likely need to update this docs generator.
 *
 * @param schema
 * @returns
 */
export const simpleDocs = (schema: SchemaObject): string => {
  return `---
title: architect.yml
---
# architect.yml

This document describes the full specification of the [architect.yml](/docs/configuration/architect-yml) configuration file. The top level of your \`architect.yml\` should be a [ComponentSpec](#componentspec).

We've published a formal definition of this specification here: [Architect JSONSchema](https://raw.githubusercontent.com/architect-team/architect-cli/master/src/dependency-manager/schema/architect.schema.json).

If you're using VS Code (or any other IDE with intellisense backed by [SchemaStore](https://www.schemastore.org/json/)), then you should already see syntax highlighting when editing any file named \`architect.yml\`.

Note that each reference to a \`Dict<T>\` type refers to a key-value object where the keys are strings and the values are of type T.

${schemaToMarkdown(schema)}
`;
};

