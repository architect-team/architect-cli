import { validate, validateSync, ValidationError, ValidatorOptions } from 'class-validator';
import { flattenValidationErrors } from './errors';

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

  validateSync(options?: ValidatorOptions): ValidationError[] {
    options = { whitelist: true, forbidNonWhitelisted: true, forbidUnknownValues: true, ...(options || {}) };
    return validateSync(this, options);
  }

  validateOrRejectSync(options?: ValidatorOptions) {
    const errors = this.validateSync(options);
    if (errors.length)
      throw Error(JSON.stringify(flattenValidationErrors(errors), null, 2));
  }
}
