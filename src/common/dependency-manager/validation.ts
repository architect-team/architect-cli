import chalk from 'chalk';
import { Dictionary, ValidationError, ValidationErrors } from '../../';

export const prettyValidationErrors = (error: ValidationErrors): void => {
  if (!error.file) {
    console.error(chalk.red(error.name));
    console.error(chalk.red(error.message));
    return;
  }
  const errors = JSON.parse(error.message) as ValidationError[];

  const errors_row_map: Dictionary<ValidationError> = {};
  let min_row = Infinity;
  let max_row = -Infinity;
  let missing_line_numbers = false;
  for (const error of errors) {
    if (error.start && error.end) {
      // TODO handle multiple errors on one row?
      errors_row_map[error.start.row] = error;
      if (error.start.row < min_row) {
        min_row = error.start.row;
      }
      if (error.start.row > max_row) {
        max_row = error.start.row;
      }
    } else {
      missing_line_numbers = true;
    }
  }

  if (missing_line_numbers) {
    console.error(chalk.red(error.name));
    console.error(chalk.red(error.message));
    return;
  }

  min_row = Math.max(min_row - 4, 0);
  max_row = max_row + 3;

  const res = [];
  let line_number = min_row + 1;
  const lines = error.file.contents.split('\n').slice(min_row, max_row);
  const lines_length = lines.length;
  const max_number_length = `${min_row + lines_length}`.length;
  for (const line of lines) {
    const error = errors_row_map[line_number];

    const line_number_space = (max_number_length - `${line_number}`.length);

    let number_line = error ? chalk.red('›') + ' ' : '  ';
    number_line += chalk.gray(`${' '.repeat(line_number_space)}${line_number} | `);
    number_line += chalk.cyan(line);
    res.push(number_line);

    if (error?.start && error?.end) {
      let error_line = chalk.gray(`${' '.repeat(max_number_length + 2)} | `);
      error_line += ' '.repeat(error.start.column - 1);
      error_line += chalk.red('﹋'.repeat(Math.max(((error.end.column - error.start.column) + 1) / 2, 1)));
      error_line += ' ';
      error_line += chalk.red(error.message);
      res.push(error_line);
    }

    line_number += 1;
  }

  console.error(chalk.red(error.name));
  console.error(res.join('\n'));
};
