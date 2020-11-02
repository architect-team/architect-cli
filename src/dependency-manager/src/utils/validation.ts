import { isObject, matches, ValidationError, ValidatorOptions } from 'class-validator';
import { BaseSpec } from './base-spec';
import { interpolateString, InterpolationErrors } from './interpolation';

export const validateNested = async <T extends Record<string, any>>(
  target: T,
  property: string,
  errors: ValidationError[] = [],
  options?: ValidatorOptions,
): Promise<ValidationError[]> => {
  const value = (target as any)[property];
  if (value === undefined || value === null) {
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
  regex?: RegExp
): Promise<ValidationError[]> => {
  const property_value = (target as any)[property];
  if (property_value === undefined || property_value === null) {
    return errors;
  }

  const error_index = errors.findIndex(err => err.property === property);
  let error = new ValidationError();
  error.property = property;
  error.target = target;
  error.value = property_value;
  error.children = [];
  if (error_index >= 0) {
    error = errors.splice(error_index, 1)[0];
  }

  if (!isObject(property_value)) {
    error.constraints = {
      'IsObject': `${property} must be an object`,
    };
    errors.push(error);
    return errors;
  }

  for (const [key, value] of Object.entries((property_value || {}))) {
    if (regex && !matches(key, regex)) {
      const key_error = new ValidationError();
      key_error.property = key;
      key_error.target = property_value;
      key_error.value = value;
      key_error.children = [];
      key_error.constraints = {
        'Matches': `${key} must match ${regex} regular expression`,
      };

      error.children.push(key_error);
    }

    if (!condition || condition(value)) {
      error.children = error.children.concat(await validateNested(property_value, key, error.children, options));
    }
  }

  if ((error.constraints && Object.keys(error.constraints).length) || error.children.length) {
    errors.push(error);
  }

  return errors;
};

export const validateInterpolation = (param_value: string, context: any, ignore_keys: string[] = []): ValidationError[] => {
  const errors = [];
  try {
    interpolateString(param_value, context, ignore_keys, 1);
  } catch (err) {
    if (err instanceof InterpolationErrors) {
      const validation_error = new ValidationError();
      validation_error.property = 'interpolation';
      validation_error.children = [];
      for (const e of err.errors) {
        const interpolation_error = new ValidationError();
        interpolation_error.property = e;
        interpolation_error.value = e;
        interpolation_error.children = [];
        interpolation_error.constraints = {
          'interpolation': `\${{ ${e} }} is invalid`,
        };
        validation_error.children.push(interpolation_error);
      }
      errors.push(validation_error);
    } else {
      throw err;
    }
  }
  return errors;
};

// validates that property1 and property2 do not share any common keys
export const validateCrossDictionaryCollisions = async <T extends BaseSpec>(
  target: T,
  property1: string,
  property2: string,
  errors: ValidationError[] = [],
) => {
  const dictionary1 = (target as any)[property1];
  if (dictionary1 === undefined || dictionary1 === null || typeof dictionary1 !== 'object') {
    return errors;
  }
  const dictionary2 = (target as any)[property2];
  if (dictionary2 === undefined || dictionary2 === null || typeof dictionary2 !== 'object') {
    return errors;
  }

  const colliding_keys = Object.keys(dictionary1 || {}).find((s: string) => !!dictionary2[s]);
  if (colliding_keys?.length) {
    const error = new ValidationError();
    error.property = property1;
    error.target = target;
    error.value = colliding_keys;
    error.constraints = {
      'Collision': `${property1} and ${property2} must not share the same keys`,
    };
    error.children = [];

    errors.push(error);
  }
  return errors;
};
