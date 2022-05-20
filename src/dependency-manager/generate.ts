import fs from 'fs-extra';
import path from 'path';
import { getArchitectJSONSchema } from './spec/utils/json-schema';
import { simpleDocs } from './spec/utils/spec-docs';

const output_path = path.join(__dirname, './schema/architect.schema.json');
fs.writeJSONSync(output_path, getArchitectJSONSchema(), { spaces: 2 });

// use the schema to generate markdown docs and write them to our docs directory
const markdown = simpleDocs(getArchitectJSONSchema());
fs.writeFileSync('./docs/5-reference/2-architect-yml.md', markdown);
