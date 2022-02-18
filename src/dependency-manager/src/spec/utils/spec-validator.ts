import Ajv, { ErrorObject, ValidateFunction } from "ajv";
import ajv_errors from "ajv-errors";
import addFormats from "ajv-formats";
import { plainToClass } from 'class-transformer';
import cron from 'cron-validate';
import { Dictionary } from '../../utils/dictionary';
import { ValidationError, ValidationErrors } from '../../utils/errors';
import { buildContextMap, replaceBrackets } from '../../utils/interpolation';
import { findPotentialMatch } from '../../utils/match';
import { ParsedYaml } from '../../utils/types';
import { ComponentInstanceMetadata, ComponentSpec } from '../component-spec';
import { IF_EXPRESSION_REGEX } from './interpolation';
import { findDefinition, getArchitectJSONSchema } from './json-schema';

export type AjvError = ErrorObject[] | null | undefined;

export const mapAjvErrors = (parsed_yml: ParsedYaml, ajv_errors: AjvError): ValidationError[] => {
  if (!ajv_errors?.length) {
    return [];
  }

  // Expand ajv-errors errorMessage
  for (const ajv_error of ajv_errors.filter(e => e.keyword === 'errorMessage')) {
    for (const error of ajv_error.params.errors) {
      if (error.keyword === 'additionalProperties') {
        error.message = ajv_error.message;
        error.params.has_message = true;
        ajv_errors.push(error);
      }
    }
  }

  const ajv_error_map: Dictionary<ErrorObject> = {};
  for (const ajv_error of ajv_errors) {
    // Ignore noisy and redundant anyOf errors
    if (ajv_error.keyword === 'anyOf') {
      continue;
    }

    ajv_error.instancePath = ajv_error.instancePath.replace(/\//g, '.').replace('.', '');

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const additional_property: string | undefined = ajv_error.params?.additionalProperty;
    if (additional_property) {
      if (!ajv_error.params.has_message) {
        ajv_error.message = `Invalid key: ${additional_property}`;

        const definition = findDefinition(replaceBrackets(ajv_error.instancePath), getArchitectJSONSchema());
        if (definition) {
          const keys = Object.keys(definition.properties || {}).map((key) => ajv_error.instancePath ? `${ajv_error.instancePath}.${key}` : key);

          const potential_match = findPotentialMatch(`${ajv_error.instancePath}.${additional_property}`, keys);

          if (potential_match) {
            const match_keys = potential_match.split('.');
            ajv_error.message += ` - Did you mean ${match_keys[match_keys.length - 1]}?`;
          }
        }
      }

      ajv_error.instancePath += ajv_error.instancePath ? `.${additional_property}` : additional_property;
    }

    if (!ajv_error_map[ajv_error.instancePath]) {
      ajv_error_map[ajv_error.instancePath] = ajv_error;
    } else {
      ajv_error_map[ajv_error.instancePath].message += ` or ${ajv_error.message}`;
    }
  }

  // Filter error list to remove less specific errors
  const sorted_data_path_keys = Object.keys(ajv_error_map).sort(function (a, b) {
    return b.length - a.length;
  });
  const ignore_data_paths = new Set<string>();
  for (const data_path of sorted_data_path_keys) {
    const segments_list = data_path.split('.');
    const segments = segments_list.slice(0, segments_list.length - 1);
    let path = '';
    for (const segment of segments) {
      path += path ? `.${segment}` : segment;
      ignore_data_paths.add(path);
    }
  }

  const context_map = buildContextMap(parsed_yml);

  const errors: ValidationError[] = [];
  for (const [data_path, error] of Object.entries(ajv_error_map)) {
    if (ignore_data_paths.has(data_path)) {
      continue;
    }
    const normalized_path = replaceBrackets(data_path);
    let value = context_map[normalized_path?.startsWith('.') ? normalized_path.substr(1) : normalized_path];

    if (value instanceof Object && JSON.stringify(value).length > 1000) {
      value = '<truncated-object>';
    }

    errors.push(new ValidationError({
      component: parsed_yml instanceof Object ? (parsed_yml as any).name : '<unknown>',
      path: error.instancePath,
      message: error.message?.replace(/__arc__/g, '') || 'Unknown error',
      value: value === undefined ? '<unknown>' : value,
      invalid_key: error.keyword === 'additionalProperties',
    }));
  }

  return errors;
};

const cron_options = { preset: 'default', override: { useBlankDay: true } };

let _cached_validate: ValidateFunction;
export const validateSpec = (parsed_yml: ParsedYaml): ValidationError[] => {
  if (!_cached_validate) {
    // TODO:288 enable strict mode?
    const ajv = new Ajv({ allErrors: true, unicodeRegExp: false });
    addFormats(ajv);
    ajv.addFormat('cidrv4', /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\/(?:3[0-2]|[12]?[0-9]))?$/);
    ajv.addFormat('cron', (value: string): boolean => value === "" || cron(value, cron_options).isValid());
    ajv.addKeyword('externalDocs');
    // https://github.com/ajv-validator/ajv-errors
    ajv_errors(ajv);
    _cached_validate = ajv.compile(getArchitectJSONSchema());
  }

  const valid = _cached_validate(parsed_yml);
  if (!valid) {
    return mapAjvErrors(parsed_yml, _cached_validate.errors);
  }
  return [];
};


export const validateServiceAndTaskKeys = (component: ComponentSpec): ValidationError[] => {
  const errors = [];

  // checks for duplicate keys across the two dictionaries
  const service_keys = Object.keys(component.services || {});
  const task_keys = Object.keys(component.tasks || {});
  const duplicates = service_keys.filter(s => task_keys.includes(s)).filter(s => !IF_EXPRESSION_REGEX.test(s));

  if (duplicates.length) {
    const error = new ValidationError({
      component: component.name,
      path: 'services',
      message: 'services and tasks must not share the same keys',
      value: duplicates,
    });
    errors.push(error);
  }

  return errors;
};

export const isPartOfCircularReference = (search_name: string, depends_on_map: { [name: string]: string[] }, current_name?: string, seen_names: string[] = []): boolean => {
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

export const validateDependsOn = (component: ComponentSpec): ValidationError[] => {
  const errors = [];
  const depends_on_map: { [name: string]: string[] } = {};

  for (const [name, service] of Object.entries(component.services || {})) {
    depends_on_map[name] = service.depends_on || [];
  }

  const task_map: { [name: string]: boolean } = {};
  for (const [name, service] of Object.entries(component.tasks || {})) {
    depends_on_map[name] = service.depends_on || [];
    task_map[name] = true;
  }

  for (const [name, dependencies] of Object.entries(depends_on_map)) {
    for (const dependency of dependencies) {

      if (task_map[dependency]) {
        const error = new ValidationError({
          component: component.name,
          path: `services.${name}.depends_on`,
          message: `services.${name}.depends_on.${dependency} must refer to a service, not a task`,
          value: dependency,
        });
        errors.push(error);
      }

      if (!depends_on_map[dependency]) {
        const error = new ValidationError({
          component: component.name,
          path: `services.${name}.depends_on`,
          message: `services.${name}.depends_on.${dependency} must refer to a valid service`,
          value: dependency,
        });
        errors.push(error);
      }
    }
    if (isPartOfCircularReference(name, depends_on_map)) {
      const error = new ValidationError({
        component: component.name,
        path: `services.${name}.depends_on`,
        message: `services.${name}.depends_on must not contain a circular reference`,
        value: depends_on_map[name],
      });
      errors.push(error);
    }
  }

  return errors;
};

export const validateOrRejectSpec = (parsed_yml: ParsedYaml, metadata?: ComponentInstanceMetadata): ComponentSpec => {
  const errors = validateSpec(parsed_yml);

  if (errors && errors.length) {
    throw new ValidationErrors(errors);
  }

  const component_spec = plainToClass(ComponentSpec, parsed_yml);

  if (metadata) {
    component_spec.metadata = metadata;
  } else {
    throw new Error('TODO:344');
    /*
    // TODO:344 cleanup
    const name = (parsed_yml as any).name.includes('/') ? (parsed_yml as any).name : 'local/' + (parsed_yml as any).name;
    component_spec.metadata = {
      ref: `${name}:latest`,
      tag: 'latest',
      instance_date: new Date(),
      proxy_port_mapping: {},
    };
    */
  }

  // TODO:344 remove
  errors.push(...validateServiceAndTaskKeys(component_spec));
  errors.push(...validateDependsOn(component_spec));

  if (errors && errors.length) {
    throw new ValidationErrors(errors);
  }

  return component_spec;
};
