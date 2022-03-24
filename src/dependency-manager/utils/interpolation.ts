import deepmerge from 'deepmerge';
import { EXPRESSION_REGEX, IF_EXPRESSION_REGEX } from '../spec/utils/interpolation';
import { Dictionary } from './dictionary';
import { ValidationError, ValidationErrors } from './errors';
import { findPotentialMatch } from './match';
import { ArchitectParser } from './parser';
import { matches } from './regex';

export const replaceBrackets = (value: string): string => {
  return value.replace(/\[/g, '.').replace(/['|"|\]|\\]/g, '');
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

export const buildContextMap = (context: any): any => {
  const context_map: Dictionary<any> = {};
  const queue = [['', context]];
  while (queue.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [prefix, c] = queue.shift()!;

    if (c instanceof Object) {
      if (prefix) {
        context_map[prefix] = c;
      }
      for (const [key, value] of Object.entries(c)) {
        queue.push([prefix ? `${prefix}.${key}` : key, value]);
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
  ignore_keys?: string[]
}

const overwriteMerge = (destinationArray: any[], sourceArray: any[], options: deepmerge.Options) => sourceArray;

export const interpolateObject = <T>(obj: T, context: any, options?: InterpolateObjectOptions): { errors: ValidationError[]; interpolated_obj: T } => {
  // Clone object
  obj = deepmerge(obj, {}) as T;

  const context_map = buildContextMap(context);
  const context_keys = Object.keys(context_map);

  // Interpolate only keys first to flatten conditionals
  options = {
    keys: false,
    values: true,
    ignore_keys: [],
    ...options,
  };

  const parser = new ArchitectParser();

  let errors: ValidationError[] = [];

  let queue = [[obj, []]];
  while (queue.length) {
    const [el, path_keys] = queue.shift() as [any, string[]];
    if (el instanceof Object) {
      let has_conditional = false;
      const to_add = [];
      for (const [key, value] of Object.entries(el) as [string, any][]) {
        // TODO:333
        if (key === 'metadata') {
          continue;
        }
        const current_path_keys = [...path_keys, key];
        context_map['_path'] = current_path_keys.join('.');
        delete el[key];
        if (options.keys && IF_EXPRESSION_REGEX.test(key)) {
          const parsed_key = parser.parseString(key, context_map, options.ignore_keys);
          if (parsed_key === true) {
            has_conditional = true;
            for (const [key2, value2] of Object.entries(deepmerge(el, value, { arrayMerge: overwriteMerge }))) {
              el[key2] = value2;
            }
          }
          for (const error of parser.errors) {
            error.invalid_key = true;
          }
        } else if (options.values && typeof value === 'string') {
          const parsed_value = parser.parseString(value, context_map, options.ignore_keys);
          el[key] = parsed_value;
        } else {
          el[key] = value;
          if (value instanceof Object) {
            to_add.push([value, current_path_keys]);
          }
        }
        for (const error of parser.errors) {
          const potential_match = findPotentialMatch(error.value, context_keys);
          if (potential_match) {
            error.message += ` - Did you mean \${{ ${potential_match} }}?`;
          }
          error.path = current_path_keys.join('.');
        }
        errors = errors.concat(parser.errors);
        parser.errors = [];
      }
      if (has_conditional) {
        queue.unshift([el, path_keys]);
      } else {
        queue = queue.concat(to_add);
      }
    }
  }

  return { errors, interpolated_obj: obj };
};

export const interpolateObjectOrReject = <T>(obj: T, context: any, options?: InterpolateObjectOptions): T => {
  const { interpolated_obj, errors } = interpolateObject(obj, context, options);
  if (errors.length) {
    throw new ValidationErrors(errors, options?.file);
  }
  return interpolated_obj;
};

export const interpolateObjectLoose = <T>(obj: T, context: any, options?: InterpolateObjectOptions): T => {
  const { interpolated_obj } = interpolateObject(obj, context, options);
  return interpolated_obj;
};
