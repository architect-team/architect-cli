import fs from 'fs-extra';
import { ARCHITECT_JSON_SCHEMA } from './json-schema';

fs.copyFileSync('./architect-schema.json', './0-previous-architect-schema.json');
fs.writeFileSync('./architect-schema.json', JSON.stringify(ARCHITECT_JSON_SCHEMA, null, 2));
