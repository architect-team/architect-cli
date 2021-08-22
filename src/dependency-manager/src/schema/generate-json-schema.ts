import fs from 'fs-extra';
import path from 'path';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';

const output_path = path.join(__dirname, '../../component-schema.json');
fs.writeJSONSync(output_path, ARCHITECT_JSON_SCHEMA, { spaces: 2 });
