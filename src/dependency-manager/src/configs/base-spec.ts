import { plainToClassFromExist } from 'class-transformer';
import { validate, ValidationError, ValidationOptions } from 'class-validator';

export abstract class BaseSpec {
  constructor(plain?: any) {
    plainToClassFromExist(this, plain);
  }

  async validate(options?: ValidationOptions): Promise<ValidationError[]> {
    return validate(this, options);
  }

  async validateOrReject(options?: ValidationOptions) {
    const errors = await this.validate(options);
    if (errors.length)
      return Promise.reject(errors);
  }
}