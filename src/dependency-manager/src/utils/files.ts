import fs from 'fs';
import path from 'path';
import untildify from 'untildify';

// https://stackoverflow.com/questions/4253367/how-to-escape-a-json-string-containing-newline-characters-using-javascript
const escape = function (str: string) {
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

export const insertFileDataFromRefs = (file_contents: string, config_path: string) => {
  let updated_file_contents = file_contents;
  updated_file_contents = JSON.stringify(JSON.parse(updated_file_contents), null, 2); // important in the case of a JSON file as a single line
  const file_regex = new RegExp('^(?!.*"extends)[a-zA-Z0-9_"\\s:]*(file:.*\\..*)(",|")$', 'gm');
  let matches;
  while ((matches = file_regex.exec(updated_file_contents)) != null) {
    const file_path = untildify(matches[1].slice('file:'.length));
    const file_data = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8').trim();
    updated_file_contents = updated_file_contents.replace(matches[1], escape(file_data));
  }
  return updated_file_contents;
};
