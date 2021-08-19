
export class ArchitectError extends Error { }

export class ValidationError {
  path: string;
  message: string;
  value?: any;

  constructor(data: { path: string; message: string; value?: any }) {
    this.path = data.path;
    this.message = data.message;
    this.value = data.value;
  }
}

export class ValidationErrors extends ArchitectError {
  constructor(errors: any[]) {
    super();
    this.name = `ValidationErrors`;
    this.message = JSON.stringify(errors, null, 2);
  }
}
