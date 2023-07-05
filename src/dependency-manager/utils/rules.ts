
import { ValidationError } from './errors';
import { findPotentialMatch } from './match';

interface ContextMap {
  name: string;
  _path: string;
  _obj_map: any;
  [key: string]: any;
}

export const CONTEXT_KEY_DELIMITER = '__dot__';

const dot_regex = new RegExp(CONTEXT_KEY_DELIMITER, 'g');

abstract class InterpolationRule {
  abstract check(context_map: ContextMap, context_key: string): string | undefined;

  run(context_map: ContextMap, context_key: string): ValidationError | undefined {
    const maybe_message = this.check(context_map, context_key);
    if (maybe_message) {
      return new ValidationError({
        component: context_map.name,
        path: context_map._path.replace(dot_regex, '.'),
        message: maybe_message,
        value: context_key,
      });
    }
  }
}

class BuildInterpolationRule extends InterpolationRule {
  /**
   * Returns true if the interpolation is inside of a build block
   * and the interpolation is not a secret value.
   */
  protected checkPathAndKey(path: string, key?: string) {
    const split = path.split('.').filter(path => !path.startsWith('${{'));
    const is_build_block = (split[0] === 'services' || split[0] === 'tasks') && split[2] === 'build';
    if (is_build_block && key) {
      return !key.startsWith('secrets');
    }
    return is_build_block;
  }

  check(context_map: ContextMap, context_key: string): string | undefined {
    // Special case - make exception for "local" environments in/around build block
    const last_key = context_map._path.split('.').pop()?.replace(/ /g, '').replace(dot_regex, '.');
    if (context_key === 'architect.environment' && last_key === `\${{ if architect.environment == 'local' }}`.replace(/ /g, '')) {
      return;
    }

    if (this.checkPathAndKey(context_map._path, context_key)) {
      return `Cannot use \${{ ${context_key} }} inside a build block. The build block is immutable. Use architect dev --arg KEY=VALUE or use secrets for build args.`;
    }

    // Check if the interpolation is around a build block
    const maybe_child_key = Object.keys(context_map._obj_map).find(key => key.startsWith(`${context_map._path}.`) && this.checkPathAndKey(key));
    if (maybe_child_key) {
      return `Cannot use \${{ ${context_key} }} around a build block. The build block is immutable. Use architect dev --arg KEY=VALUE or use secrets for build args.`;
    }
  }
}

export class RequiredInterpolationRule extends InterpolationRule {
  static PREFIX = 'Invalid interpolation ref:';

  check(context_map: ContextMap, context_key: string): string | undefined {
    if (!(context_key in context_map)) {
      let message = `${RequiredInterpolationRule.PREFIX} \${{ ${context_key} }}`;
      const potential_match = findPotentialMatch(context_key, Object.keys(context_map));
      if (potential_match) {
        message += ` - Did you mean \${{ ${potential_match} }}?`;
      }
      return message;
    }
  }
}

const rules = [
  new BuildInterpolationRule(),
  new RequiredInterpolationRule(),
];

export function checkRules(context_map: ContextMap, context_key: string): ValidationError | undefined {
  if (!context_map._path) {
    return;
  }
  for (const rule of rules) {
    const maybe_error = rule.run(context_map, context_key);
    if (maybe_error) {
      return maybe_error;
    }
  }
}
