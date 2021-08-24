import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { ParsedYaml } from '../schema/component-builder';

// https://stackoverflow.com/questions/4253367/how-to-escape-a-json-string-containing-newline-characters-using-javascript
const escape = (str: string): string => {
  return str
    .replace(/[\\]/g, '\\\\')
    .replace(/["]/g, '\\"')
    .replace(/[/]/g, '\\/')
    .replace(/[\b]/g, '\\b')
    .replace(/[\f]/g, '\\f')
    .replace(/[\n]/g, '\\n')
    .replace(/[\r]/g, '\\r')
    .replace(/[\t]/g, '\\t');
};

export const tryReadFromPaths = (try_files: string[]): { file_path: string; file_contents: string } => {
  // Make sure the file exists
  let file_path;
  let file_contents;
  for (const file of try_files) {
    try {
      const data = fs.lstatSync(file);
      if (data.isFile()) {
        file_contents = fs.readFileSync(file, 'utf-8');
        file_path = file;
        break;
      }
    } catch {
      continue;
    }
  }

  if (!file_contents || !file_path) {
    throw new Error('File not found');
  }

  return { file_path, file_contents };
};

const escapeEnvironmentInterpolation = (str: string): string => {
  return str.replace(/\${([^{].*})/g, '$$$$$${$1');
};

export const readFile = (any_or_path: any, config_path: string): any => {
  const file_path = untildify(any_or_path.slice('file:'.length));
  const res = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8');
  return escape(escapeEnvironmentInterpolation(res.trim()));
};

export const readIfFile = (any_or_path: any, config_path: string): any => {
  if (any_or_path && any_or_path.startsWith && any_or_path.startsWith('file:')) {
    return readFile(any_or_path, config_path);
  } else {
    return any_or_path;
  }
};

export const insertFileDataFromRefs = (file_contents: string, config_path: string) => {
  let updated_file_contents = file_contents;
  const file_regex = new RegExp('^(?!.*"extends)[a-zA-Z0-9_"\\s:]*(file:.*\\..*)(",|")$', 'gm');
  let matches;
  while ((matches = file_regex.exec(updated_file_contents)) != null) {
    updated_file_contents = updated_file_contents.replace(matches[1], readFile(matches[1], config_path));
  }
  return updated_file_contents;
};

export const replaceFileReference = (parsed_yml: ParsedYaml, config_path: string) => {
  const source_as_json = JSON.stringify(parsed_yml, null, 2);
  const replaced_source = insertFileDataFromRefs(source_as_json, config_path);
  const replaced_object = JSON.parse(replaced_source);

  return yaml.dump(replaced_object);
};
