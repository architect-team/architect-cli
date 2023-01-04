import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { ArchitectError } from './errors';
import { ParsedYaml } from './types';

// https://stackoverflow.com/questions/4253367/how-to-escape-a-json-string-containing-newline-characters-using-javascript
const escape = (str: string): string => {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\//g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/\f/g, '\\f')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
};

const escapeEnvironmentInterpolation = (str: string): string => {
  return str.replace(/\${([^{].*})/g, '$$$$$${$1');
};

export const readFile = (any_or_path: any, config_path: string): string => {
  const file_path = untildify(any_or_path.slice('file:'.length));
  const res = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8');
  return escape(escapeEnvironmentInterpolation(res.trim()));
};

export const insertFileDataFromRefs = (file_contents: string, config_path: string): string => {
  let updated_file_contents = file_contents;
  const file_regex = new RegExp('^(?!.*"extends)[a-zA-Z0-9_"\\s:]*(file:.*\\..*)(",|")$', 'gm');
  let matches;
  while ((matches = file_regex.exec(updated_file_contents)) !== null) {
    updated_file_contents = updated_file_contents.replace(matches[1], readFile(matches[1], config_path));
  }
  return updated_file_contents;
};

export const replaceFileReference = (parsed_yml: ParsedYaml, config_path: string): string => {
  if ((parsed_yml || '').toString().trim().length === 0) {
    throw new ArchitectError(`The file at ${config_path} is empty.  For help getting started take a look at our documentation here: https://docs.architect.io/reference/architect-yml`, false);
  }
  const source_as_json = JSON.stringify(parsed_yml, null, 2);
  const replaced_source = insertFileDataFromRefs(source_as_json, config_path);
  const replaced_object = JSON.parse(replaced_source);

  return yaml.dump(replaced_object);
};
