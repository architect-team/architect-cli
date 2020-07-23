import { classToClass, plainToClassFromExist } from 'class-transformer';
import { ClassType } from 'class-transformer/ClassTransformer';
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

  getClass() {
    return this.constructor as ClassType<any>;
  }
}

export abstract class ConfigSpec extends BaseSpec {
  /** @return New copy of the current config */
  copy(): this {
    return classToClass(this);
  }

  /**
   * @param config Config to be merged with this config
   * @return New copy of the current config
   * */
  merge(config: this): this {
    return plainToClassFromExist(this.expand(), config.expand());
  }

  /** @return New expanded copy of the current config */
  abstract expand(): this;
}
