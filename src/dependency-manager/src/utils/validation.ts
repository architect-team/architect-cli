import { ValidationError, ValidatorOptions } from 'class-validator';
import { BaseSpec } from './base-spec';

export const validateNested = async <T extends Record<string, any>>(
  target: T,
  property: string,
  errors: ValidationError[] = [],
  options?: ValidatorOptions,
): Promise<ValidationError[]> => {
  const value = (target as any)[property];
  if (value === undefined) {
    return errors;
  }
  const error_index = errors.findIndex(err => err.property === property);

  let error = new ValidationError();
  error.property = property;
  error.target = target;
  error.value = value;
  error.children = [];
  if (error_index >= 0) {
    error = errors.splice(error_index, 1)[0];
  }

  if (Array.isArray(value)) {
    for (const index in value) {
      error.children = await validateNested(value, index, error.children, options);
    }
  } else if (value instanceof BaseSpec) {
    error.children = await value.validate(options) || [];
  }

  if ((error.constraints && Object.keys(error.constraints).length) || error.children.length) {
    errors.push(error);
  }

  return errors;
};

export const validateDictionary = async <T extends BaseSpec>(
  target: T,
  property: string,
  errors: ValidationError[] = [],
  condition?: (value: any) => boolean,
  options?: ValidatorOptions,
): Promise<ValidationError[]> => {
  const property_value = (target as any)[property];
  const error_index = errors.findIndex(err => err.property === property);

  let error = new ValidationError();
  error.property = property;
  error.target = target;
  error.value = property_value;
  error.children = [];
  if (error_index >= 0) {
    error = errors.splice(error_index, 1)[0];
  }

  for (const [key, value] of Object.entries((property_value || {}))) {
    if (!condition || condition(value)) {
      error.children = await validateNested(property_value, key, error.children, options);
    }
  }

  if ((error.constraints && Object.keys(error.constraints).length) || error.children.length) {
    errors.push(error);
  }

  return errors;
};
