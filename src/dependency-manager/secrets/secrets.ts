import { ComponentSlugUtils, ComponentVersionSlugUtils, Slugs } from '../spec/utils/slugs';
import { ValidationError, ValidationErrors } from '../utils/errors';
import { SecretsDict } from './type';

export class SecretsConfig {
  static validate(secrets_dict: SecretsDict): void {
    if (!secrets_dict) {
      return;
    }

    const validation_errors = [];
    for (const [component_key, component_secrets] of Object.entries(secrets_dict)) {
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
          value: component_secrets,
        });
        validation_errors.push(validation_error);
      }

      // check that secrets are only strings and not things like arrays or objects
      if (typeof component_secrets !== 'object' || Array.isArray(component_secrets)) {
        const validation_error = new ValidationError({
          component: component_key,
          path: component_key,
          message: `The value for ${component_key} must be an object.`,
          value: component_secrets,
        });
        validation_errors.push(validation_error);
      }

      if (typeof component_secrets === 'object' && !(Array.isArray(component_secrets))) {
        for (const [secret_key, secret_value] of Object.entries(component_secrets || {})) {
          // check that keys of values use allowed characters
          if (!Slugs.ComponentSecretValidator.test(secret_key)) {
            const validation_error = new ValidationError({
              component: component_key,
              path: `${component_key}.${secret_key}`,
              message: `${secret_key} should only contain alphanumerics and underscores, and cannot start or end with an underscore.`,
              value: secret_value,
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
