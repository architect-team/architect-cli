import { ValidationError } from 'class-validator';
import { Dictionary } from './dictionary';

export class Errors {

  public static format(error: ApiError) {
    return `Call to ${error.path} returned ${error.statusCode}: ${error.message}`;
  }

}

export interface ApiError {
  statusCode: number;
  message: string;
  timestamp: string;
  path: string;
}

/**
 * Takes an array of ValidationErrors and flattens it to a dictionary. Each
 * key of the dictionary is a dot-notation property, and each value is a dictionary
 * of the failed constraits.
 */
export const flattenValidationErrors = (errors: ValidationError[], property_prefix = ''): Dictionary<Dictionary<string>> => {
  let res = {} as Dictionary<Dictionary<string>>;
  errors.forEach(error => {
    const property = `${property_prefix}${error.property}`;
    if (error.constraints && Object.keys(error.constraints).length) {
      res[property] = error.constraints;
    }

    if (error.children && error.children.length) {
      res = {
        ...res,
        ...flattenValidationErrors(error.children, `${property}.`),
      };
    }
  });
  return res;
};
