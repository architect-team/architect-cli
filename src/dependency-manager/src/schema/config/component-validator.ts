import { ValidationError } from 'class-validator';
import { ComponentConfig } from './component-config';

export const validateServiceAndTaskKeys = (componentConfig: ComponentConfig): ValidationError[] => {
  const errors = [];

  // checks for duplicate keys across the two dictionaries
  const service_keys = Object.keys(componentConfig.services);
  const task_keys = Object.keys(componentConfig.tasks);
  const duplicates = service_keys.filter(s => task_keys.includes(s));

  if (duplicates.length) {
    const error = new ValidationError();
    error.property = 'services';
    error.target = componentConfig;
    error.value = duplicates;
    error.constraints = {
      'Collision': `services and tasks must not share the same keys`,
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

export const validateDependsOn = (component: ComponentConfig): ValidationError[] => {
  const errors = [];
  const depends_on_map: { [name: string]: string[] } = {};

  for (const [name, service] of Object.entries(component.services)) {
    depends_on_map[name] = service.depends_on;
  }

  const task_map: { [name: string]: boolean } = {};
  for (const [name, service] of Object.entries(component.tasks)) {
    depends_on_map[name] = service.depends_on;
    task_map[name] = true;
  }

  for (const [name, dependencies] of Object.entries(depends_on_map)) {
    for (const dependency of dependencies) {

      if (task_map[dependency]) {
        const error = new ValidationError();
        error.property = 'depends_on';
        error.target = component;
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
        error.target = component;
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
      error.target = component;
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

export const validateConfig = (component: ComponentConfig): ValidationError[] => {
  const errors: ValidationError[] = [];

  errors.push(...validateServiceAndTaskKeys(component)); //TODO:269: make new ticket to explore moving this to JSONSchema
  errors.push(...validateDependsOn(component));

  return errors;
};

export const validateOrRejectConfig = (component: ComponentConfig): void => {
  const errors = validateConfig(component);

  if (errors.length) {
    throw new Error(JSON.stringify(errors));
  }
};
