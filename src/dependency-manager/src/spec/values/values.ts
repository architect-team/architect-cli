import { flattenValidationErrorsWithLineNumbers, ValidationError, ValidationErrors } from '../../utils/errors';

export class ValuesConfig {
  static validate(values_dict: any) {
    if (!values_dict) {
      return [];
    }

    const validation_errors = [];
    for (const [component_key, component_values] of Object.entries(values_dict)) {

      // check that keys only contain alphanumerics, underscores, and maybe an asterisk
      const component_key_regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9/:.-]*[*a-zA-Z0-9]$', 'mg');
      const component_key_matches = component_key_regex.exec(component_key);
      if (!component_key_matches && component_key !== '*') {
        const validation_error = new ValidationError();
        validation_error.property = component_key;
        validation_error.target = component_values as any;
        validation_error.value = component_values;
        validation_error.constraints = { Invalid: `${component_key} must be a full or partial component reference, optionally ending with an asterisk.` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }

      // check that values are only strings and not things like arrays or objects
      if (typeof component_values !== 'object' || component_values instanceof Array) {
        const validation_error = new ValidationError();
        validation_error.property = component_key;
        validation_error.target = component_values as any;
        validation_error.value = component_values;
        validation_error.constraints = { Invalid: `The value for ${component_key} must be an object.` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }

      if (typeof component_values === 'object' && !(component_values instanceof Array)) {
        for (const [param_key, param_value] of Object.entries(component_values || {})) {
          const parameter_regex = new RegExp('^[a-zA-Z0-9][a-zA-Z0-9_]+[a-zA-Z0-9]$', 'mg');
          const parameter_matches = parameter_regex.exec(param_key);

          // check that keys of values use allowed characters
          if (!parameter_matches) {
            const validation_error = new ValidationError();
            validation_error.property = `${component_key}.${param_key}`;
            validation_error.target = param_value;
            validation_error.value = param_value;
            validation_error.constraints = { Invalid: `${param_key} should only contain alphanumerics and underscores, and cannot start or end with an underscore.` };
            validation_error.children = [];
            validation_errors.push(validation_error);
          }

          // check that param value is a string
          if (typeof param_value !== 'string') {
            const validation_error = new ValidationError();
            validation_error.property = `${component_key}.${param_key}`;
            validation_error.target = param_value;
            validation_error.value = param_value;
            validation_error.constraints = { Invalid: `${param_key} must be a string.` };
            validation_error.children = [];
            validation_errors.push(validation_error);
          }
        }
      }
    }

    if (validation_errors.length) {
      throw new ValidationErrors('values', flattenValidationErrorsWithLineNumbers(validation_errors, JSON.stringify(values_dict, null, 2)));
    }
  }
}
