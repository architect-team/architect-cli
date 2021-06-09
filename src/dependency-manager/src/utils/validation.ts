import { isObject, matches, ValidationError, ValidatorOptions } from 'class-validator';
import { ValidatableConfig } from '../spec/base-spec';
import { ComponentConfig } from '../spec/component/component-config';

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
  } else if (value instanceof ValidatableConfig) {
    error.children = await value.validate(options) || [];
  }

  if ((error.constraints && Object.keys(error.constraints).length) || error.children?.length) {
    errors.push(error);
  }

  return errors;
};

export const validateDictionary = async <T extends ValidatableConfig>(
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

      error.children = error.children || [];
      error.children.push(key_error);
    }

    if (!condition || condition(value)) {
      error.children = error.children || [];
      error.children = error.children.concat(await validateNested(property_value, key, error.children, options));
    }
  }

  if ((error.constraints && Object.keys(error.constraints).length) || error.children?.length) {
    errors.push(error);
  }

  return errors;
};

// validates that property1 and property2 do not share any common keys
export const validateCrossDictionaryCollisions = async <T extends ValidatableConfig>(
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

export const isPartOfCircularReference = (search_name: string, depends_on_map: { [name: string]: string[] }, current_name?: string, seen_names: string[] = []) => {
  const next_name = current_name || search_name;
  const dependencies = depends_on_map[next_name];

  if (seen_names.includes(next_name)) {
    return false;
  }

  seen_names.push(next_name);

  if (!dependencies?.length) {
    return false;
  }

  for (const dependency of dependencies) {
    if (dependency === search_name) {
      return true;
    } else if (isPartOfCircularReference(search_name, depends_on_map, dependency, seen_names)) {
      return true;
    }
  }

  return false;
};

// validates that property1 and property2 do not share any common keys
export const validateDependsOn = async <T extends ValidatableConfig>(
  target: ComponentConfig,
  errors: ValidationError[] = [],
) => {
  const depends_on_map: { [name: string]: string[] } = {};

  for (const [name, service] of Object.entries(target.getServices())) {
    const depends_on = service.getDependsOn();
    depends_on_map[name] = depends_on;
  }

  const task_map: { [name: string]: boolean } = {};
  for (const [name, service] of Object.entries(target.getTasks())) {
    const depends_on = service.getDependsOn();
    depends_on_map[name] = depends_on;
    task_map[name] = true;
  }

  for (const [name, dependencies] of Object.entries(depends_on_map)) {
    for (const dependency of dependencies) {

      if (task_map[dependency]) {
        const error = new ValidationError();
        error.property = 'depends_on';
        error.target = target;
        error.value = name;
        error.constraints = {
          'no-task-dependency': `${name}.depends_on[${dependency}] must refer to a service, not a task`,
        };
        error.children = [];

        errors.push(error);
      }

      if (!depends_on_map[dependency]) {
        const error = new ValidationError();
        error.property = 'depends_on';
        error.target = target;
        error.value = name;
        error.constraints = {
          'invalid-reference': `${name}.depends_on[${dependency}] must refer to a valid service`,
        };
        error.children = [];

        errors.push(error);
      }
    }
    if (isPartOfCircularReference(name, depends_on_map)) {
      const error = new ValidationError();
      error.property = 'depends_on';
      error.target = target;
      error.value = name;
      error.constraints = {
        'circular-reference': `${name}.depends_on must not contain a circular reference`,
      };
      error.children = [];

      errors.push(error);
    }
  }

  return errors;
};
