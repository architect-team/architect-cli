import { instanceToInstance } from 'class-transformer';
import deepmerge from 'deepmerge';
import { EXPRESSION_REGEX, IF_EXPRESSION_REGEX } from '../spec/utils/interpolation';
import { Dictionary } from './dictionary';
import { ValidationError, ValidationErrors } from './errors';
import { ArchitectParser } from './parser';
import { matches } from './regex';
import { CONTEXT_KEY_DELIMITER } from './rules';
import { ComponentSpec } from '../spec/component-spec';
import { ArchitectContext, DependencyContext, ServiceContext } from '../config/component-context';
import { IngressConfig, ServiceInterfaceConfig } from '../config/service-config';

export const replaceBrackets = (value: string): string => {
  return value.replace(/\[/g, '.').replace(/["'\\\]|]/g, '');
};

/*
${{ dependencies['architect/cloud'].services }} -> ${{ dependencies.architect/cloud.services }}
${{ dependencies["architect/cloud"].services }} -> ${{ dependencies.architect/cloud.services }}
*/
export const replaceInterpolationBrackets = (value: string): string => {
  let res = value;
  for (const match of matches(value, EXPRESSION_REGEX)) {
    res = res.replace(match[0], `\${{ ${replaceBrackets(match[1])} }}`);
  }
  return res;
};

/*
  Create mock dependencies for dependencies.<dependency-name>.services.*.interfaces.*.<ingress-config-prop>
*/
const createMockDependencies = (component_spec: ComponentSpec) => {
  const dependencies: Dictionary<DependencyContext> = {};
  for (const dep_name of Object.keys(component_spec.dependencies || {})) {
    const mock_service_interface_config: ServiceInterfaceConfig = {
      host: '',
      port: '',
      protocol: '',
      username: '',
      password: '',
      url: '',
      sticky: '',
      path: '',
      ingress: { private: false } as IngressConfig,
    };
    const mock_service_context: ServiceContext = {
      interfaces: { '*': mock_service_interface_config },
      environment: {},
    };

    const dependency_context = {
      name: dep_name,
      dependencies: {},
      secrets: {},
      outputs: {},
      databases: {},
      services: { '*': mock_service_context },
      tasks: {},
      architect: {} as ArchitectContext,
    };
    dependencies[dep_name] = {
      services: dependency_context.services || {},
      outputs: dependency_context.outputs || {},
    };
  }
  return dependencies;
};

export const buildContextMap = (context: any, use_mock_dependencies?: boolean): any => {
  const context_map: Dictionary<any> = {};
  if (use_mock_dependencies) {
    context.dependencies = createMockDependencies(context);
  }

  const queue = [['', context]];
  while (queue.length > 0) {
    const [prefix, c] = queue.shift()!;

    if (c instanceof Object) {
      if (prefix) {
        context_map[prefix] = c;
      }
      for (const [key, value] of Object.entries(c)) {
        queue.push([prefix ? `${prefix}.${key.replace(/\./g, CONTEXT_KEY_DELIMITER)}` : key.replace(/\./g, CONTEXT_KEY_DELIMITER), value]);
      }
    } else if (prefix) {
      context_map[prefix] = c;
    }
  }
  return context_map;
};

export interface InterpolateObjectOptions {
  keys?: boolean;
  values?: boolean;
  file?: { path: string, contents: string };
}

const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: deepmerge.Options) => sourceArray;

export const interpolateObject = <T>(obj: T, context: any, _options?: InterpolateObjectOptions): { errors: ValidationError[]; interpolated_obj: T } => {
  // Clone object
  obj = instanceToInstance(obj);

  const context_map = buildContextMap(context);
  context_map._path = '';
  context_map._obj_map = buildContextMap(obj);

  // Interpolate only keys first to flatten conditionals
  const options = {
    keys: false,
    values: true,
    ..._options,
  };

  const parser = new ArchitectParser();

  let errors: ValidationError[] = [];

  let queue = [[obj, []]];
  while (queue.length > 0) {
    const [el, path_keys] = queue.shift() as [any, string[]];
    if (el instanceof Object) {
      let has_conditional = false;
      const to_add = [];
      for (const [key, value] of Object.entries(el) as [string, any][]) {
        if (key === 'metadata') {
          continue;
        }
        const current_path_keys = [...path_keys, key.replace(/\./g, CONTEXT_KEY_DELIMITER)];
        context_map._path = current_path_keys.join('.');
        delete el[key];
        if (options.keys && IF_EXPRESSION_REGEX.test(key)) {
          const parsed_key = parser.parseString(key, context_map);
          if (parsed_key === true) {
            has_conditional = true;
            for (const [key2, value2] of Object.entries(deepmerge(el, value, { arrayMerge: overwriteMerge }))) {
              el[key2] = value2;
            }
          } else if (parser.errors.length > 0) {
            el[key] = value;
            to_add.push([value, current_path_keys]);
          }

          for (const error of parser.errors) {
            error.invalid_key = true;
          }
        } else if (options.values && typeof value === 'string') {
          const parsed_value = parser.parseString(value, context_map);
          el[key] = parsed_value;
        } else {
          el[key] = value;
          if (value instanceof Object) {
            to_add.push([value, current_path_keys]);
          }
        }
        errors = [...errors, ...parser.errors];
        parser.errors = [];
      }
      if (has_conditional) {
        queue.unshift([el, path_keys]);
      } else {
        queue = [...queue, ...to_add];
      }
    }
  }

  return { errors, interpolated_obj: obj };
};

export const interpolateObjectOrReject = <T>(obj: T, context: any, options?: InterpolateObjectOptions): T => {
  const { interpolated_obj, errors } = interpolateObject(obj, context, options);
  if (errors.length > 0) {
    throw new ValidationErrors(errors, options?.file);
  }
  return interpolated_obj;
};

export const interpolateObjectLoose = <T>(obj: T, context: any, options?: InterpolateObjectOptions): T => {
  const { interpolated_obj } = interpolateObject(obj, context, options);
  return interpolated_obj;
};
