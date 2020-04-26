import { ClassTransformOptions, plainToClassFromExist } from 'class-transformer';
import { validate, ValidationError, ValidatorOptions } from 'class-validator';

export abstract class BaseSpec {
  constructor(plain?: any, options?: ClassTransformOptions) {
    plainToClassFromExist(this, plain, options);
  }

  async validate(options?: ValidatorOptions): Promise<ValidationError[]> {
    return validate(this, options);
  }

  async validateOrReject(options?: ValidatorOptions) {
    const errors = await this.validate(options);
    if (errors.length)
      return Promise.reject(errors);
  }
}
