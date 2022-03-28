import { ComponentSlugUtils, ComponentVersionSlugUtils, Slugs } from '../spec/utils/slugs';
import { ValidationError, ValidationErrors } from '../utils/errors';

export class ValuesConfig {
  static validate(values_dict: any): void {
    if (!values_dict) {
      return;
    }

    const validation_errors = [];
    for (const [component_key, component_values] of Object.entries(values_dict)) {
      let key = component_key.endsWith('*') ? component_key.substring(0, component_key.length - 1) : component_key;
      key = key.endsWith(':') ? key.substring(0, key.length - 1) : key;
      key = key.endsWith('/') ? key.substring(0, key.length - 1) : key;

      // Backwards compat for tags
      if (ComponentVersionSlugUtils.Validator.test(key)) {
        const { component_account_name, component_name, instance_name } = ComponentVersionSlugUtils.parse(key);
        key = ComponentSlugUtils.build(component_account_name, component_name, instance_name);
      }

      if (
        !ComponentSlugUtils.Validator.test(key) &&
        !Slugs.ArchitectSlugValidator.test(key) &&
        component_key !== '*'
      ) {
        const validation_error = new ValidationError({
          component: component_key,
          path: component_key,
          message: `${component_key} must be a full or partial component reference, optionally ending with an asterisk.`,
          value: component_values,
        });
        validation_errors.push(validation_error);
      }

      // check that values are only strings and not things like arrays or objects
      if (typeof component_values !== 'object' || component_values instanceof Array) {
        const validation_error = new ValidationError({
          component: component_key,
          path: component_key,
          message: `The value for ${component_key} must be an object.`,
          value: component_values,
        });
        validation_errors.push(validation_error);
      }

      if (typeof component_values === 'object' && !(component_values instanceof Array)) {
        for (const [param_key, param_value] of Object.entries(component_values || {})) {
          // check that keys of values use allowed characters
          if (!Slugs.ComponentParameterValidator.test(param_key)) {
            const validation_error = new ValidationError({
              component: component_key,
              path: `${component_key}.${param_key}`,
              message: `${param_key} should only contain alphanumerics and underscores, and cannot start or end with an underscore.`,
              value: param_value,
            });
            validation_errors.push(validation_error);
          }
        }
      }
    }

    if (validation_errors.length) {
      throw new ValidationErrors(validation_errors);
    }
  }
}
