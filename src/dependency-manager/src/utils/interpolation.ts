import yaml from 'js-yaml';
import { EXPRESSION_REGEX_STRING } from '../spec/utils/interpolation';
import { findPotentialMatch } from '../spec/utils/spec-validator';
import { Dictionary } from './dictionary';
import { ValidationErrors } from './errors';

const interpolation_regex = new RegExp(EXPRESSION_REGEX_STRING, 'g');

export const replaceBrackets = (value: string): string => {
  return value.replace(/\[/g, '.').replace(/['|"|\]|\\]/g, '');
};

const matches = (text: string, pattern: RegExp) => ({
  [Symbol.iterator]: function* () {
    const clone = new RegExp(pattern.source, pattern.flags);
    let match = null;
    do {
      match = clone.exec(text);
      if (match) {
        yield match;
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
  for (const match of matches(value, interpolation_regex)) {
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

/**
 * Check if a value needs to be stringified or not.
 *
 * It does if it JSON.parses to an object or if it is a multiline string
 */
export const normalizeValueForInterpolation = (value: any): string => {
  if (value === undefined) {
    return '';
  }
  if (value instanceof Object) {
    return JSON.stringify(value);
  } else if (typeof value === 'string' && value.includes('\n')) {
    return JSON.stringify(value.trimEnd());
  } else {
    return value;
  }
};

export const interpolateString = (raw_value: string, context: any, ignore_keys: string[] = [], max_depth = 25): string => {
  const context_map = buildContextMap(context);
  const context_keys = Object.keys(context_map);

  let res = raw_value;

  let has_matches = true;
  let depth = 0;
  const misses = new Set<string>();
  while (has_matches) {
    has_matches = false;
    depth += 1;
    if (depth >= max_depth) {
      throw new Error('Max interpolation depth exceeded');
    }
    for (const match of matches(res, interpolation_regex)) {
      const sanitized_value = replaceBrackets(match[1]);
      const value = context_map[sanitized_value];

      if (value === undefined) {
        const ignored = ignore_keys.some((k) => sanitized_value.startsWith(k));
        if (!ignored) {
          misses.add(match[1]);
        }
      }

      res = res.replace(match[0], normalizeValueForInterpolation(value));
      has_matches = true;
    }
  }

  const errors = [];

  const reverse_context_map: Dictionary<string> = {};
  if (misses.size) {
    try {
      const value = yaml.load(raw_value);
      const context_map = buildContextMap(value);
      for (const [k, v] of Object.entries(context_map)) {
        if (typeof v === 'string') {
          for (const match of matches(v, interpolation_regex)) {
            reverse_context_map[match[1]] = k;
          }
        }
      }
      // eslint-disable-next-line no-empty
    } catch { }
  }

  for (const miss of misses) {
    const potential_match = findPotentialMatch(miss, context_keys);

    let message = `Invalid interpolation ref: \${{ ${miss} }}`;
    if (potential_match) {
      message += ` - Did you mean \${{ ${potential_match} }}?`;
    }
    errors.push({
      path: reverse_context_map[miss] || '<unknown>',
      message,
    });
  }

  if (errors.length) {
    throw new ValidationErrors(errors);
  }

  return res;
};
