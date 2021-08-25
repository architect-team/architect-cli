import fs from 'fs-extra';
import path from 'path';
import { ARCHITECT_JSON_SCHEMA } from './spec/json-schema';
import { simpleDocs } from './utils/spec-docs';

const output_path = path.join(__dirname, './../schema/architect.schema.json');
fs.writeJSONSync(output_path, ARCHITECT_JSON_SCHEMA, { spaces: 2 });

// use the schema to generate markdown docs and write them to our docs directory
const markdown = simpleDocs(ARCHITECT_JSON_SCHEMA);
fs.writeFileSync('../../docs/5-reference/2-architect-yml.md', markdown);
