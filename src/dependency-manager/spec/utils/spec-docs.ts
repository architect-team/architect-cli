import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ComponentInterfaceSpec, ComponentSpec, ParameterDefinitionSpec } from '../component-spec';
import { ServiceSpec } from '../service-spec';
import { TaskSpec } from '../task-spec';
import { DEBUG_PREFIX, getDocsPath, stripDebugDefinitions } from './json-schema';
import { REF_PREFIX } from './json-schema-annotations';

const OPEN = '&lt;';
const CLOSE = '&gt;';
const MD_NEWLINE = '\n\n';
const OR = ' \\| ';
const MD_SEPERATOR = ' | ';

const header = (value: string) => {
  return `---\ntitle: ${value}\n---`;
};

const h1 = (value: string) => {
  return `# ${value}`;
};

const strikethrough = (value: string): string => {
  return `~~${value}~~`;
};

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
  } else if (property.type === 'array') {
    const type = (property?.items as SchemaObject)?.type;
    return `Array${OPEN}any${CLOSE}`;
  } else {
    throw new Error('Docs generator is missing a case');
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
      } else if ((prop as SchemaObject)?.type && (prop as SchemaObject)?.pattern === '\\${{\\s*(.*?)\\s*}}') {
        types.push(`[Expression](/docs/reference/contexts)`);
      } else if ((prop as SchemaObject)?.type && (prop as SchemaObject)?.pattern) {
        const primitive = (prop as SchemaObject).type as string;
        types.push(primitive);
      } else if ((prop as SchemaObject)?.type && !(prop as SchemaObject)?.pattern) {
        const primitive = (prop as SchemaObject).type as string;
        types.push(primitive);
      } else if ((prop as SchemaObject)?.anyOf) {
        const anyof_types = anyOfPropertyTypeToMarkdown((prop as SchemaObject)).split(OR);
        types.push(...anyof_types);
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

// describes the debug field in the docs, this is required because we manipulate the _DebugSpec manually and JSONSchema disallows setting a description next to a $ref property.
export const debug_description = (): string => {
  return `A partial object that is deep-merged into the spec on local deployments. Useful to mount developer volumes or set other local-development configuration. Think of this as a "local override" block.`;
};

const patternPropertyToMarkdown = (): string => {
  return `Dict${OPEN}string${CLOSE}`;
};

const propertyToType = (prop_body: SchemaObject | ReferenceObject): string => {
  if (prop_body.$ref) {
    return propertyRefToMarkdown(prop_body as ReferenceObject);
  } else if ((prop_body as SchemaObject)?.patternProperties && (prop_body as SchemaObject)?.type === 'object') {
    return patternPropertyToMarkdown();
  } else {
    return propertyTypeToMarkdown(prop_body);
  }
};

const propertyToDescription = (prop_body: SchemaObject | ReferenceObject): string => {
  if ((prop_body as SchemaObject).description) {
    return `${(prop_body as SchemaObject).description}`;
  } else if (prop_body.$ref && prop_body.$ref.includes(DEBUG_PREFIX)) {
    return debug_description();
  } else {
    return ``;
  }
};

const propertyToFieldName = (prop_name: string, prop_body: SchemaObject | ReferenceObject, required: boolean): string => {
  const property = `\`${prop_name}\`${required ? '*' : ''}`;
  const deprecated = (prop_body as SchemaObject)?.deprecated;

  return deprecated ? strikethrough(property) : property;
};

const propertyToRegex = (prop_body: SchemaObject | ReferenceObject): string => {
  if ((prop_body as SchemaObject)?.pattern) {
    const pattern = (prop_body as SchemaObject).pattern as string;
    return `Must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(pattern)}">Regex</a>`;
  } else if ((prop_body as SchemaObject)?.patternProperties) {
    for (const [key, value] of Object.entries((prop_body as SchemaObject)?.patternProperties).slice(0, 1)) {
      return `<a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(key)}">KeyRegex</a>, <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent((value as any).pattern)}">ValueRegex</a>, `;
    }
  }
  return ``;
};

const propertyToMisc = (prop_body: SchemaObject | ReferenceObject): string => {
  let markdown = propertyToRegex(prop_body);
  let delimiter = '';

  if ((prop_body as SchemaObject)?.default) {
    markdown += delimiter;
    markdown += `default: \`${(prop_body as SchemaObject)?.default}\``;
    delimiter = ',';
  }


  if ((prop_body as SchemaObject)?.deprecated) {
    markdown += delimiter;
    markdown += `Deprecated`;
    delimiter = ',';
  }


  if ((prop_body as SchemaObject)?.externalDocs) {
    const externalDocs = (prop_body as SchemaObject).externalDocs?.url;
    markdown += delimiter;
    markdown += `[More](${externalDocs})`;
    delimiter = ',';
  }

  return markdown;
};

const definitionToMarkdown = (spec_name: string, definition: SchemaObject): string => {
  if (!definition.description) {
    throw new Error(`Spec classes should all be annotated with a description for the docs but ${spec_name} has none.`);
  }

  if (!definition.properties) {
    throw new Error(`Spec classes should all have at least one property on them, otherwise docs generation probably needs to be changed. ${spec_name} has no properties set.`);
  }

  let markdown = `## ${spec_name}`;
  markdown += `\n\n`;
  markdown += `${definition.description}`;
  markdown += `\n\n`;
  markdown += `| Field  (*=required)  | Type       | Description    | Misc           |\n`;
  markdown += `| -------------------- | ---------- | -------------- | -------------- |\n`;

  for (const [prop_name, prop_body] of Object.entries(definition.properties)) {
    const required = !!definition.required && definition.required.includes(prop_name);
    markdown += ` | ${propertyToFieldName(prop_name, prop_body, required)}`;
    markdown += ` | ${propertyToType(prop_body)}`;
    markdown += ` | ${propertyToDescription(prop_body)}`;
    markdown += ` | ${propertyToMisc(prop_body)}`;
    markdown += ` |\n`;
  }

  markdown += `\n\n`;

  return markdown;
};

const schemaToMarkdown = (schema: SchemaObject): string => {
  let markdown = '';

  const no_debug_schema = stripDebugDefinitions(schema);

  // re-order the keys in the map to provide more natural ordering in the docs
  const ordered_definitions: { [key: string]: SchemaObject } = {
    ComponentSpec: no_debug_schema.definitions[ComponentSpec.name],
    ServiceSpec: no_debug_schema.definitions[ServiceSpec.name],
    ParameterDefinitionSpec: no_debug_schema.definitions[ParameterDefinitionSpec.name],
    ComponentInterfaceSpec: no_debug_schema.definitions[ComponentInterfaceSpec.name],
    TaskSpec: no_debug_schema.definitions[TaskSpec.name],
    ...no_debug_schema.definitions,
  };

  for (const [spec_name, definition] of Object.entries(ordered_definitions)) {
    markdown += definitionToMarkdown(spec_name, definition);
  }

  return markdown;
};

const docs_description = () => {
  return `This document describes the full specification of the [architect.yml](/docs/components/architect-yml) configuration file. The top level of your \`architect.yml\` should be a [ComponentSpec](#componentspec).

We've published a formal definition of this specification here: [Architect JSONSchema](https://raw.githubusercontent.com/architect-team/architect-cli/master/src/dependency-manager/schema/architect.schema.json).

If you're using VS Code (or any other IDE with intellisense backed by [SchemaStore](https://www.schemastore.org/json/)), then you should already see syntax highlighting when editing any file named \`architect.yml\`.

**Note**: all references to the \`Dict<T>\` type below refer to a key-value map where the keys are strings and the values are of type T.`;
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
  let markdown = header(`architect.yml`);
  markdown += `\n\n`;
  markdown += h1(`architect.yml`);
  markdown += `\n\n`;
  markdown += docs_description();
  markdown += `\n\n`;
  markdown += schemaToMarkdown(schema);
  return markdown;
};

