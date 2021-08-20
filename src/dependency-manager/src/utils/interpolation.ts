import leven from 'leven';
import { Dictionary } from './dictionary';
import { ValidationErrors } from './errors';

const interpolation_regex = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');

export const replaceBrackets = (value: string) => {
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
export const replaceInterpolationBrackets = (value: string) => {
  let res = value;
  for (const match of matches(value, interpolation_regex)) {
    res = res.replace(match[0], `\${{ ${replaceBrackets(match[1])} }}`);
  }
  return res;
};

export const escapeJSON = (value: any) => {
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

export const buildContextMap = (context: any, include_objects = false) => {
  const context_map: Dictionary<any> = {};
  const queue = [['', context]];
  while (queue.length) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const [prefix, c] = queue.shift()!;

    if (c instanceof Object) {
      if (prefix && include_objects) {
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
export const requires_stringify = (value: any): boolean => {
  if (typeof value !== 'string') {
    return false;
  }

  let needs_stringify = false;
  try {
    const parsed = JSON.parse(value);
    if (typeof parsed === 'object') {
      needs_stringify = true;
    }
    // eslint-disable-next-line no-empty
  } catch (e) {
  }

  if (value.includes('\n')) {
    needs_stringify = true;
  }

  return needs_stringify;
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

      const stringify = requires_stringify(value);

      if (stringify) {
        res = res.replace(match[0], value === undefined ? '' : JSON.stringify(value.trimEnd()));
      } else {
        res = res.replace(match[0], value === undefined ? '' : value);
      }
      has_matches = true;
    }
  }

  const errors = [];

  const max_distance = 10;
  for (const miss of misses) {
    const miss_length = miss.length;
    const shortest_distance = Infinity;
    let potential_match = '';
    for (const key of context_keys) {
      // https://github.com/sindresorhus/leven/issues/14
      if (Math.abs(miss_length - key.length) >= max_distance) {
        continue;
      }

      const distance = leven(miss, key);
      if (distance < shortest_distance && distance < max_distance) {
        potential_match = key;
      }
    }

    let message = `Invalid interpolation ref: \${{ ${miss} }}`;
    if (potential_match) {
      message += ` - Did you mean \${{ ${potential_match} }}?`;
    }
    // TODO:288: provide line numbers - should be able to derive from raw_value
    errors.push({
      // dataPath: `TODO:288`, // we need to find the path where the interpolation string is referenced and set that here.
      message,
    });
  }

  if (errors.length) {
    throw new ValidationErrors(errors);
  }

  return res;
};
