import yaml from 'js-yaml';
import { addLineNumbers } from '../spec/utils/spec-validator';

export class ArchitectError extends Error { }

export const isValidationErrorString = (error_string: string): boolean => {
  try {
    const validation_errors = JSON.parse(error_string);
    if (Array.isArray(validation_errors) && validation_errors?.length) {
      if ('component' in validation_errors[0] && 'path' in validation_errors[0] && 'invalid_key' in validation_errors[0] && 'message' in validation_errors[0]) {
        return true;
      }
    }
    // eslint-disable-next-line no-empty
  } catch { }
  return false;
};

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
