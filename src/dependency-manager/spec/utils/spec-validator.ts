import type { V1Deployment } from '@kubernetes/client-node';
import Ajv, { ErrorObject, ValidateFunction } from 'ajv';
import ajv_errors from 'ajv-errors';
import addFormats from 'ajv-formats';
import { plainToInstance } from 'class-transformer';
import cron from 'cron-validate';
import TSON from 'typescript-json';
import { DeepPartial } from '../../../common/utils/types';
import { Dictionary } from '../../utils/dictionary';
import { ValidationError, ValidationErrors } from '../../utils/errors';
import { buildContextMap, interpolateObject, replaceBrackets } from '../../utils/interpolation';
import { findPotentialMatch } from '../../utils/match';
import { RequiredInterpolationRule } from '../../utils/rules';
import { ParsedYaml } from '../../utils/types';
import { ComponentInstanceMetadata, ComponentSpec } from '../component-spec';
import { ServiceInterfaceSpec } from '../service-spec';
import { findDefinition, getArchitectJSONSchema } from './json-schema';
import { Slugs } from './slugs';

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
    const segments = segments_list.slice(0, -1);
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
    let value = context_map[normalized_path?.startsWith('.') ? normalized_path.substring(1) : normalized_path];

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
    ajv.addFormat('cidrv4', /^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)(?:\/(?:3[0-2]|[12]?\d))?$/);
    ajv.addFormat('cron', (value: string): boolean => value === '' || cron(value, cron_options).isValid());
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

export const validateVolumes = (component_spec: ComponentSpec): ValidationError[] => {
  if (component_spec.metadata.interpolated) {
    return [];
  }

  const errors = [];

  for (const [service_name, service_spec] of Object.entries(component_spec.services || {})) {
    for (const [volume_name, volume_spec] of Object.entries(service_spec.volumes || {})) {
      const no_host_path = volume_spec instanceof Object ? !volume_spec.host_path : true;
      if (no_host_path) {
        const error = new ValidationError({
          component: component_spec.name,
          path: `services.${service_name}.volumes.${volume_name}`,
          message: `services.${service_name}.volumes.${volume_name} must have a host_path or nested in the debug block`,
          value: volume_spec,
        });
        errors.push(error);
      }
    }
  }

  return errors;
};

export const validateDependsOn = (component: ComponentSpec): ValidationError[] => {
  const errors = [];
  const depends_on_map: { [name: string]: string[] } = {};

  for (const [name, service] of Object.entries(component.services || {})) {
    depends_on_map[service.reserved_name || name] = service.depends_on || [];
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

function deprecatedInterfaces(spec: ComponentSpec) {
  const services = spec.services || {};
  const interfaces = spec.deprecated_interfaces;
  for (const [interface_name, interface_config_or_string] of Object.entries(interfaces)) {
    const interface_config = interface_config_or_string instanceof Object ? interface_config_or_string : { url: interface_config_or_string };

    const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
    const matches = url_regex.exec(interface_config.url);
    if (matches) {
      const interface_ref = matches[1];

      const [services_text, service_name, interfaces_text, service_interface_name] = interface_ref.split('.');
      if (services_text !== 'services') {
        continue;
      }
      if (interfaces_text !== 'interfaces') {
        continue;
      }
      if (!(service_name in services)) {
        continue;
      }

      const service_interfaces = services[service_name].interfaces;
      if (!service_interfaces) {
        continue;
      }

      const service_interface = service_interfaces[service_interface_name];

      const service_interface_obj = service_interface instanceof Object ? service_interface : { port: service_interface };
      if (service_interface_obj) {
        const new_interface: ServiceInterfaceSpec = {
          ...service_interface_obj,
        };
        if (interface_config.sticky !== undefined) {
          new_interface.sticky = interface_config.sticky;
        }
        if (interface_config.ingress !== undefined) {
          new_interface.ingress = interface_config.ingress;
        }
        service_interfaces[interface_name] = new_interface;
        spec.metadata.deprecated_interfaces_map[interface_name] = service_name;
      }
    }
  }
}

export const buildSpec = (parsed_yml: ParsedYaml, metadata?: ComponentInstanceMetadata): ComponentSpec => {
  const component_spec = plainToInstance(ComponentSpec, parsed_yml);

  component_spec.metadata = metadata ? metadata : {
    ref: component_spec.name,
    tag: 'latest',
    instance_date: new Date(),
    deprecated_interfaces_map: {},
  };

  deprecatedInterfaces(component_spec);

  return component_spec;
};

export const validateOrRejectSpec = (parsed_yml: ParsedYaml, metadata?: ComponentInstanceMetadata): ComponentSpec => {
  const errors = validateSpec(parsed_yml);

  if (errors && errors.length > 0) {
    throw new ValidationErrors(errors);
  }

  const component_spec = buildSpec(parsed_yml, metadata);

  if (component_spec.databases && component_spec.services) {
    const service_names = Object.keys(component_spec.services);
    for (const database of Object.keys(component_spec.databases)) {
      if (service_names.includes(`${database}${Slugs.DB_SUFFIX}`)) {
        const validation_error = new ValidationError({
          component: component_spec.name,
          path: `databases.${database}`,
          message: `There is a naming collision with the database ${database} and service ${database}${Slugs.DB_SUFFIX}. Database names use both ${database} and ${database}${Slugs.DB_SUFFIX}.`,
          invalid_key: true,
        });
        errors.push(validation_error);
      }
    }
  }

  for (const [service_name, service_spec] of Object.entries(component_spec.services || {})) {
    if (service_spec.deploy && service_spec.deploy.kubernetes.deployment) {
      // Only works if transpileOnly=false in ./bin/dev
      const res = TSON.validateEquals<DeepPartial<V1Deployment>>(service_spec.deploy.kubernetes.deployment);

      for (const tson_error of res.errors) {
        const error = new ValidationError({
          component: component_spec.name,
          path: `services.${service_name}.deploy.kubernetes.deployment.${tson_error.path.replace('$input.', '')}`,
          message: `Invalid kubernetes deployment override. ${tson_error.expected !== 'undefined' ? `Expected: ${tson_error.expected}` : 'Error: Invalid key'}`,
          value: service_spec.deploy.kubernetes.deployment,
          invalid_key: true,
        });
        errors.push(error);
      }
    }
  }

  errors.push(
    ...validateVolumes(component_spec),
    ...validateDependsOn(component_spec),
  );

  if (errors && errors.length > 0) {
    throw new ValidationErrors(errors);
  }

  return component_spec;
};

export const validateInterpolation = (component_spec: ComponentSpec): void => {
  const { errors } = interpolateObject(component_spec, {}, {
    keys: true,
    values: true,
    file: component_spec.metadata.file,
  });

  const filtered_errors = errors.filter(error => !error.message.startsWith(RequiredInterpolationRule.PREFIX));

  if (filtered_errors.length > 0) {
    throw new ValidationErrors(filtered_errors, component_spec.metadata.file);
  }
};
