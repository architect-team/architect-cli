import { isMatch } from 'matcher';
import { SecretDefinitionSpec, SecretSpecValue, transformSecretDefinitionSpec } from '../..';
import { ComponentConfig } from '../config/component-config';
import { ComponentSpec } from '../spec/component-spec';
import { ComponentSlugUtils, ComponentVersionSlugUtils, Slugs } from '../spec/utils/slugs';
import { Dictionary, transformDictionary } from '../utils/dictionary';
import { ValidationError, ValidationErrors } from '../utils/errors';
import { SecretsDict } from './type';

export class Secrets {
  protected secrets_dict: SecretsDict;
  protected account?: string;

  constructor(secrets_dict: SecretsDict, account?: string) {
    this.secrets_dict = secrets_dict;
    this.account = account;
  }

  getSecretsForComponent(component: ComponentSpec | ComponentConfig): Dictionary<SecretSpecValue> {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(this.secrets_dict).sort();
    const sorted_values_dict: SecretsDict = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = this.secrets_dict[key];
    }

    const component_ref = component.metadata.ref;
    const { component_name, instance_name } = ComponentSlugUtils.parse(component_ref);
    const component_ref_with_account = ComponentSlugUtils.build(this.account, component_name, instance_name);

    const component_secrets = new Set(Object.keys(component.secrets || {}));

    const res: Dictionary<any> = {};
    // add values from values file to all existing, matching components
    // eslint-disable-next-line prefer-const
    for (let [pattern, secrets] of Object.entries(sorted_values_dict)) {
      // Backwards compat for tags
      if (ComponentVersionSlugUtils.Validator.test(pattern)) {
        const { component_account_name, component_name, instance_name } = ComponentVersionSlugUtils.parse(pattern);
        pattern = ComponentSlugUtils.build(component_account_name, component_name, instance_name);
      }
      if (isMatch(component_ref, [pattern]) || isMatch(component_ref_with_account, [pattern])) {
        for (const [secret_key, secret_value] of Object.entries(secrets)) {
          if (component_secrets.has(secret_key)) {
            res[secret_key] = secret_value;
          }
        }
      }
    }
    return res;
  }

  validate(): void {
    if (!this.secrets_dict) {
      return;
    }

    const validation_errors = [];
    for (const [component_key, component_secrets] of Object.entries(this.secrets_dict)) {
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

    if (validation_errors.length > 0) {
      throw new ValidationErrors(validation_errors);
    }
  }

  validateComponentSpec(component_spec: ComponentSpec): void {
    const secrets_dict = this.getSecretsForComponent(component_spec);

    const validation_errors = [];

    const secrets = transformDictionary(transformSecretDefinitionSpec, component_spec.secrets);
    // Check required secrets for components
    for (const [key, value] of Object.entries(secrets)) {
      if (value.required !== false && secrets_dict[key] === undefined && value.default === undefined) {
        const validation_error = new ValidationError({
          component: component_spec.name,
          path: `secrets.${key}`,
          message: `Required secret '${key}' was not provided`,
          invalid_key: true,
        });
        validation_errors.push(validation_error);
      }
    }

    // Check required secrets for environment variables
    for (const [resource_name, resource_spec] of Object.entries(component_spec.resources)) {
      for (const [key, value] of Object.entries(resource_spec.environment || {})) {
        const secret = value instanceof SecretDefinitionSpec ? value : { default: value };

        if (secret.required !== false && secrets_dict[key] === undefined && (secret.default === undefined || secret.default === null)) {
          const validation_error = new ValidationError({
            component: component_spec.name,
            path: `${resource_spec.resource_type}.${resource_name}.environment.${key}`,
            message: `Required ${resource_spec.resource_type}-level secret '${key}' was not provided`,
            invalid_key: true,
          });
          validation_errors.push(validation_error);
        }
      }
    }

    if (validation_errors.length > 0) {
      throw new ValidationErrors(validation_errors, component_spec.metadata.file);
    }
  }
}
