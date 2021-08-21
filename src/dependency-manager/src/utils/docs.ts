import { SchemaObject } from 'openapi3-ts';

const header = (val: string) => {
  return `---\ntitle: ${val}\n---\n`;
};

const schemaToMarkdown = (schema: SchemaObject): string => {
  let markdown = '';
  for (const [name, definition] of Object.entries(schema.definitions)) {
    markdown += `#### ${name}\n\n`;
  }
  return markdown;
};


export const simpleDocs = (schema: SchemaObject): string => {
  return `${header('architect.yml')}${schemaToMarkdown(schema)}`;
};

