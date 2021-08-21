import fs from 'fs-extra';
import { ARCHITECT_JSON_SCHEMA } from './spec/json-schema';
import { simpleDocs } from './utils/docs';

const markdown = simpleDocs(ARCHITECT_JSON_SCHEMA);

fs.writeFileSync('./schema/architect.schema.json', JSON.stringify(ARCHITECT_JSON_SCHEMA, null, 2));
fs.writeFileSync('../../docs/5-reference/2-component-spec.md', markdown);
