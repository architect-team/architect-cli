import fs from 'fs';
import path from 'path';
import untildify from 'untildify';

export const insertFileDataFromRefs = (file_contents: string, file_path: string, config_path: string) => {
  let updated_file_contents = file_contents;
  if (file_path.endsWith('.yml') || file_path.endsWith('.yaml')) {
    const file_regex = new RegExp('^\\s*(?!extends)[a-zA-Z0-9_]+:\\s+(file:.*\\..*)', 'gm');
    let matches;
    while ((matches = file_regex.exec(updated_file_contents)) != null) {
      const file_path = untildify(matches[1].slice('file:'.length));
      const file_data = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8').trim();
      if (file_data.indexOf('\n') > -1) { // handle multiline files inserted into yaml
        let last_new_line_index = updated_file_contents.substring(0, updated_file_contents.indexOf(matches[1])).lastIndexOf('\n');
        let indent = ' ';
        while(updated_file_contents.substring(last_new_line_index + 1, last_new_line_index + 2) === ' ') {
          last_new_line_index++;
          indent = indent + ' ';
        }
        const updated_file_data = `|\n${file_data}`.replace(/[\n\r]/g, `\n${indent}`);
        updated_file_contents = updated_file_contents.replace(matches[1], updated_file_data);
      } else {
        updated_file_contents = updated_file_contents.replace(matches[1], file_data);
      }
    }
  } else if (file_path.endsWith('json')) {
    updated_file_contents = JSON.stringify(JSON.parse(updated_file_contents), null, 2); // important in the case of a JSON file as a single line
    const file_regex = new RegExp('^(?!.*"extends).*(file:.*\\..*)"$', 'gm');
    let matches;
    while ((matches = file_regex.exec(updated_file_contents)) != null) {
      const file_path = untildify(matches[1].slice('file:'.length));
      const file_data = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8').trim();
      console.log(file_data);
      updated_file_contents = updated_file_contents.replace(matches[1], file_data.replace(/[\n\r]/g, '\\n'));
    }
  }
  console.log(updated_file_contents);
  return updated_file_contents;
};
