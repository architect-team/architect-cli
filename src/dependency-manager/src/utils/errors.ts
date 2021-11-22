import yaml from 'js-yaml';

function escapeRegex(string: string) {
  return string.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
}

const addLineNumbers = (value: string, errors: ValidationError[]): void => {
  const rows = value.split('\n');
  const total_rows = rows.length;
  for (const error of errors) {
    const keys = error.path.split('.');
    let pattern = '(.*?)' + keys.map((key) => `${escapeRegex(key)}:`).join('(.*?)');

    const target_value = `${error.value}`.split('\n')[0];
    if (!error.invalid_key) {
      pattern += `(.*?)${escapeRegex(target_value)}`;
    }

    const exp = new RegExp(pattern, 's');
    const matches = exp.exec(value);
    if (matches) {
      const match = matches[0];
      const remaining_rows = value.replace(match, '').split('\n');
      const target_row = total_rows - remaining_rows.length;
      const end_row = rows[target_row];

      const end_length = (remaining_rows[0]?.length || 0);

      if (error.invalid_key) {
        error.start = {
          row: target_row + 1,
          column: (end_row.length - end_row.trimLeft().length) + 1,
        };
        error.end = {
          row: target_row + 1,
          column: end_row.length - end_length,
        };
      } else {
        error.start = {
          row: target_row + 1,
          column: (end_row.length - (target_value.length + (end_length ? end_length - 1 : 0))),
        };
        error.end = {
          row: target_row + 1,
          column: end_row.length - end_length,
        };
      }
    }
  }
};

export class ArchitectError extends Error { }

export class ValidationError {
  component: string;
  path: string;
  message: string;
  value?: any;
  start?: {
    row: number;
    column: number;
  };
  end?: {
    row: number;
    column: number;
  };
  invalid_key: boolean;

  constructor(data: { component: string, path: string; message: string; value?: any, invalid_key?: boolean }) {
    this.component = data.component;
    this.path = data.path;
    this.message = data.message;
    this.value = data.value;
    this.invalid_key = data.invalid_key || false;
  }
}

export class ValidationErrors extends ArchitectError {
  file?: { path: string; contents: string };

  constructor(errors: any[], file?: { path: string; contents: string }) {
    super();

    this.name = `ValidationErrors`;
    if (file) {
      addLineNumbers(file.contents, errors);
      try {
        this.name += `\ncomponent: ${(yaml.load(file.contents) as any).name}`;
        // eslint-disable-next-line no-empty
      } catch { }
      this.name += `\nfile: ${file.path}`;
    }

    this.message = JSON.stringify(errors, null, 2);
    this.file = file;
  }
}
