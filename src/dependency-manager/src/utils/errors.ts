import yaml from 'js-yaml';
import { addLineNumbers } from '../spec/utils/spec-validator';

export class ArchitectError extends Error { }

export class ValidationError {
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

  constructor(data: { path: string; message: string; value?: any, invalid_key?: boolean }) {
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
