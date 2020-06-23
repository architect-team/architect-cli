import { ValidationError } from 'class-validator';
import { Dictionary } from './dictionary';
import { replaceBrackets } from './interpolation';

export class ValidationErrors extends Error {
  errors: Dictionary<Dictionary<string | number>>;
  constructor(errors: Dictionary<Dictionary<string | number>>) {
    super();
    this.name = 'ValidationErrors';
    this.errors = errors;
    this.message = JSON.stringify(errors, null, 2);
  }
}

/**
 * Takes an array of ValidationErrors and flattens it to a dictionary. Each
 * key of the dictionary is a dot-notation property, and each value is a dictionary
 * of the failed constraits.
 */
export const flattenValidationErrors = (errors: ValidationError[], property_prefix = ''): Dictionary<Dictionary<string | number>> => {
  let res = {} as Dictionary<Dictionary<string | number>>;
  if (!(errors instanceof Array)) {
    throw errors;
  }
  errors.forEach(error => {
    let property = `${property_prefix}${error.property}`;
    if (error.constraints && Object.keys(error.constraints).length) {
      // Hack to attempt semi-reasonable validation msging for old syntax
      if (property.includes('services.service.')) {
        property = property.replace('services.service.', '').replace('components.', 'services.');
      }
      res[property] = { ...error.constraints, value: error.value };
    }

    if (error.children && error.children.length) {
      res = {
        ...res,
        ...flattenValidationErrors(error.children, `${property}.`),
      };
    }
  });
  return res;
};

export const flattenValidationErrorsWithLineNumbers = (errors: ValidationError[], file_contents: string): Dictionary<Dictionary<string | number>> => {
  file_contents = replaceBrackets(file_contents);

  const res = flattenValidationErrors(errors);
  for (const [error_key, error_obj] of Object.entries(res)) {
    if (error_key.startsWith('_interpolation')) {
      const regex = RegExp(`\\\${\\s*${error_obj.value}\\s*}`, 'gs');
      const matches = regex.exec(file_contents);
      if (matches) {
        const index = file_contents.indexOf(matches[0]);
        const matched_lines = file_contents.substring(0, index).split('\n');
        error_obj.line = matched_lines.length;
        error_obj.column = matched_lines[matched_lines.length - 1].length;
      }
    } else {
      const regex_string = '.*?' + error_key.split('.').map((key) => `${key}"?:`).join('.*?');
      const regex = RegExp(regex_string, 'gs');

      let best_index;
      let smallest_indent = Infinity;
      let match;
      let file_scanned = '';
      while (null != (match = regex.exec(file_contents))) {
        file_scanned += match[0];
        const lines = file_scanned.split('\n');
        const current_line = lines[lines.length - 1];
        const indent = current_line.search(/\S/);
        if (indent < smallest_indent) {
          smallest_indent = indent;
          best_index = file_scanned.length;
        }
      }

      if (best_index) {
        const matched_lines = file_contents.substring(0, best_index).split('\n');
        error_obj.line = matched_lines.length;
        error_obj.column = matched_lines[matched_lines.length - 1].length;
      }
    }
  }
  return res;
};
