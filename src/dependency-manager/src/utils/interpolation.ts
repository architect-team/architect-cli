import { EXPRESSION_REGEX, IF_EXPRESSION_REGEX } from '../spec/utils/interpolation';
import { findPotentialMatch } from '../spec/utils/spec-validator';
import { Dictionary } from './dictionary';
import { ValidationError, ValidationErrors } from './errors';
import { parseString } from './parser';

export const replaceBrackets = (value: string): string => {
  return value.replace(/\[/g, '.').replace(/['|"|\]|\\]/g, '');
};

export const matches = (text: string, pattern: RegExp): { [Symbol.iterator]: () => Generator<RegExpExecArray, void, unknown>; } => ({
  [Symbol.iterator]: function* () {
    const clone = new RegExp(pattern.source, pattern.flags);
    let match = null;
    do {
      match = clone.exec(text);
      if (match) {
        yield match;
        clone.lastIndex = match.index + 1; // Support overlapping match groups
      }
    } while (match);
  },
});

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

export const escapeJSON = (value: any): any => {
  if (value instanceof Object) {
    value = JSON.stringify(value);
  }

  // Support json strings
  try {
    const escaped = JSON.stringify(value);
    if (`${value}` !== escaped) {
      value = escaped.substr(1, escaped.length - 2);
    }
    // eslint-disable-next-line no-empty
  } catch { }
  return value;
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
  ignore_keys?: string[]
}

function _interpolateObject(obj: any, context_map: any, options?: InterpolateObjectOptions) {
  options = {
    keys: false,
    values: true,
    ignore_keys: [],
    ...options,
  };

  let queue = [obj];
  while (queue.length) {
    const el = queue.shift() as any;
    if (el instanceof Object) {
      let has_conditional = false;
      const to_add = [];
      for (const [key, value] of Object.entries(el) as [string, any][]) {
        delete el[key];
        if (options.keys && IF_EXPRESSION_REGEX.test(key)) {
          const parsed_key = parseString(key, context_map, options.ignore_keys);
          if (parsed_key === true) {
            has_conditional = true;
            for (const [key2, value2] of Object.entries(value)) {
              el[key2] = value2;

              // TODO:333 remove
              if (key2 === 'host') {
                context_map['services.api-db.interfaces.main.host'] = value2;
              }
            }
          }
        } else if (options.values && typeof value === 'string') {
          const parsed_value = parseString(value, context_map, options.ignore_keys);
          el[key] = parsed_value;
        } else {
          el[key] = value;
          if (value instanceof Object) {
            to_add.push(value);
          }
        }
      }
      if (has_conditional) {
        queue.unshift(el);
      } else {
        queue = queue.concat(to_add);
      }
    }
  }
}

export const interpolateObject = <T>(obj: T, context: any, options?: InterpolateObjectOptions): { errors: ValidationError[]; interpolated_obj: T } => {
  // Clone object
  obj = JSON.parse(JSON.stringify(obj));
  const context_map = buildContextMap(context);
  const context_keys = Object.keys(context_map);

  // TODO:333 make interpolateString -> interpolateObject
  // TODO:333 remove source_yml

  // TODO:333 misses
  const misses = new Set<string>();

  // Interpolate only keys first to flatten conditionals
  _interpolateObject(obj, context_map, options);
  _interpolateObject(obj, context_map, options);

  const reverse_context_map: Dictionary<string> = {};
  if (misses.size) {
    const context_map = buildContextMap(obj);
    for (const [k, v] of Object.entries(context_map)) {
      if (typeof v === 'string') {
        for (const match of matches(v, EXPRESSION_REGEX)) {
          reverse_context_map[match[1]] = k;
        }
      }
    }
  }

  const errors: ValidationError[] = [];
  for (const miss of misses) {
    const potential_match = findPotentialMatch(miss, context_keys);

    let message = `Invalid interpolation ref: \${{ ${miss} }}`;
    if (potential_match) {
      message += ` - Did you mean \${{ ${potential_match} }}?`;
    }
    errors.push(new ValidationError({
      component: context.name,
      path: reverse_context_map[miss] || '<unknown>',
      message,
      value: miss,
    }));
  }

  return { errors, interpolated_obj: obj };
};

export const interpolateObjectOrReject = <T>(obj: T, context: any, options?: InterpolateObjectOptions): T => {
  const { interpolated_obj, errors } = interpolateObject(obj, context, options);
  if (errors.length) {
    throw new ValidationErrors(errors);
  }
  return interpolated_obj;
};
