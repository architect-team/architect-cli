
import { ValidationError } from './errors';
import { findPotentialMatch } from './match';

interface ContextMap {
  name: string;
  _path: string;
  _obj_map: any;
  [key: string]: any;
}

abstract class InterpolationRule {
  abstract check(context_map: ContextMap, context_key: string): string | undefined;

  run(context_map: ContextMap, context_key: string): ValidationError | undefined {
    const maybe_message = this.check(context_map, context_key);
    if (maybe_message) {
      return new ValidationError({
        component: context_map.name,
        path: context_map._path,
        message: maybe_message,
        value: context_key,
      });
    }
  }
}

class BuildInterpolationRule extends InterpolationRule {
  protected checkKey(key: string) {
    const split = key.split('.').filter(key => !key.startsWith('${{'));
    return split[0] === 'services' && split[2] === 'build';
  }

  check(context_map: ContextMap, context_key: string): string | undefined {
    if (context_key.startsWith('architect.build.')) {
      return;
    }

    // TODO:TJ fragile and comment
    if (context_map._path.endsWith(`\${{ if architect--environment == 'local' }}`)) {
      return;
    }

    // Check if the interpolation is inside of a build block
    if (this.checkKey(context_map._path)) {
      return `Cannot use \${{ ${context_key} }} inside of a build block. Use \${{ if architect.build.tag == 'latest' }}: for build time conditionals.`;
    }

    // Check if the interpolation is around a build block
    const maybe_child_key = Object.keys(context_map._obj_map).find(key => key.startsWith(`${context_map._path}.`) && this.checkKey(key));
    if (maybe_child_key) {
      return `Cannot use \${{ ${context_key} }} around of a build block. Use \${{ if architect.build.tag == 'latest' }}: for build time conditionals.`;
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
