import { validate, ValidationError, ValidatorOptions } from 'class-validator';

export abstract class BaseSpec {
  async validate(options?: ValidatorOptions): Promise<ValidationError[]> {
    options = { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, ...(options || {}) };
    return validate(this, options);
  }

  async validateOrReject(options?: ValidatorOptions) {
    const errors = await this.validate(options);
    if (errors.length)
      return Promise.reject(errors);
  }
}
