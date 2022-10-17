import fs from 'fs-extra';
import path from 'path';
import { getArchitectJSONSchema } from './spec/utils/json-schema';
import { simpleDocs } from './spec/utils/spec-docs';

// eslint-disable-next-line unicorn/prefer-module
const output_path = path.join(__dirname, './schema/architect.schema.json');
fs.writeJSONSync(output_path, getArchitectJSONSchema(), { spaces: 2 });

// use the schema to generate markdown docs and write them to our docs directory
const markdown = simpleDocs(getArchitectJSONSchema());
fs.writeFileSync('./architect-yml.md', markdown);
