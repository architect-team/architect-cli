import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { DEBUG_PREFIX, stripDebugDefinitions } from '../spec/json-schema';
import { REF_PREFIX } from './json-schema-annotations';

const OPEN = '&lt;';
const CLOSE = '&gt;';
const OR = ' | ';

const header = (val: string) => {
  return `---\ntitle: ${val}\n---\n`;
};

const title = (val: string) => {
  return `# ${val}\n`;
};

const propertyRefToMarkdown = (property: ReferenceObject): string => {
  const type = property.$ref.replace(REF_PREFIX, '').replace(DEBUG_PREFIX, '');
  const link = type.toLowerCase();

  // if the property ref includes the Debug prefix, make it a partial
  if (property.$ref.includes(DEBUG_PREFIX)) {
    return `Partial${OPEN}<a href="#${link}">${type}</a>${CLOSE}`;
  } else {
    return `<a href="#${link}">${type}</a>`;
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

    return `Map${OPEN}string, ${types.join(OR)}${CLOSE}`;
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
  return `Map<string, string>`;
};

const propertyToMarkdown = (prop_name: string, prop_body: SchemaObject | ReferenceObject, required: boolean): string => {
  let markdown = `### ${prop_name}${required ? '*' : ''}\n\n`;

  if (required) {
    markdown += `**required**\n\n`;
  }

  if (prop_body.$ref) {
    markdown += `${propertyRefToMarkdown(prop_body as ReferenceObject)}\n\n`;
  } else if ((prop_body as SchemaObject)?.patternProperties && (prop_body as SchemaObject)?.type === 'object') {
    markdown += `${patternPropertyToMarkdown()}\n\n`;
  } else {
    markdown += `${propertyTypeToMarkdown(prop_body)}\n\n`;
  }

  if ((prop_body as SchemaObject).description) {
    markdown += `${(prop_body as SchemaObject).description}\n\n`;
  }
  // else {
  //   throw new Error('Spec fields should all be annotated with a `description` for the docs.');
  // }

  if ((prop_body as SchemaObject)?.pattern) {
    const pattern = (prop_body as SchemaObject).pattern as string;
    markdown += `Must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(pattern)}">Regex</a>\n\n`;
  }

  if ((prop_body as SchemaObject)?.patternProperties) {
    for (const [key, value] of Object.entries((prop_body as SchemaObject)?.patternProperties)) {
      markdown += `Key must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent(key)}">Regex</a>\n\n`;
      markdown += `Value must match: <a target="_blank" href="https://regexr.com/?expression=${encodeURIComponent((value as any).pattern)}">Regex</a>\n\n`;
    }
  }

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

  for (const [name, definition] of Object.entries(ordered_definitions)) {
    markdown += `## ${name}\n\n`;

    if (definition.description) {
      markdown += `${definition.description}`;
    }
    // else {
    //   throw new Error('Spec classes should all be annotated with a `description` for the docs.');
    // }

    if (definition?.properties) {
      for (const [prop_name, prop_body] of Object.entries(definition.properties)) {
        const required = !!definition.required && definition.required.includes(prop_name);
        markdown += propertyToMarkdown(prop_name, prop_body, required);
      }
    }

    markdown += `\n`;
  }

  return markdown;
};

export const simpleDocs = (schema: SchemaObject): string => {
  return `${header('architect.yml')}\n${title('architect.yml')}\n${schemaToMarkdown(schema)}`;
};

