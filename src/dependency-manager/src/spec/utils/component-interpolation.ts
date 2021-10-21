import yaml from 'js-yaml';
import { ComponentConfig } from '../../config/component-config';
import { ComponentContext } from '../../config/component-context';
import { validateConfig } from '../../config/component-validator';
import { ValidationError, ValidationErrors } from '../../utils/errors';
import { interpolateString } from '../../utils/interpolation';
import { ComponentSpec } from '../component-spec';
import { transformComponentSpec } from '../transform/component-transform';
import { validateSpec } from '../utils/spec-validator';
import { parseSourceYml } from './component-builder';

export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[], validate = true): { interpolated_config: ComponentConfig; errors: ValidationError[] } => {
  const { errors, interpolated_string } = interpolateString(config.source_yml, config.context, ignore_keys);

  if (validate && errors.length) {
    return { interpolated_config: config, errors };
  }

  // TODO:288:
  // Interpolate component context so other components can ref dependency contexts for interpolation
  // if we error here, we won't provide correct line numbers
  // we can potentially map it back to original source_yml
  // goal: get the path from the context interpolation error
  const { interpolated_string: interpolated_context, errors: interpolate_errors } = interpolateString(yaml.dump(config.context), config.context, ignore_keys);
  if (validate && errors.length) {
    return { interpolated_config: config, errors: interpolate_errors };
  }
  config.context = yaml.load(interpolated_context) as ComponentContext;

  const parsed_yml = parseSourceYml(interpolated_string);
  const spec_errors = validate ? validateSpec(parsed_yml) : [];
  if (spec_errors?.length) {
    return { interpolated_config: config, errors: spec_errors };
  }
  const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, config.source_yml, config.tag, config.instance_metadata);
  // Carry over the context because it includes information that cannot be derived. Used for dependency contexts.
  interpolated_component_config.context = config.context;
  const config_errors = validate ? validateConfig(interpolated_component_config) : [];
  return { interpolated_config: interpolated_component_config, errors: config_errors };
};

export const interpolateConfigOrReject = (config: ComponentConfig, ignore_keys: string[], validate = true): ComponentConfig => {
  const { interpolated_config, errors } = interpolateConfig(config, ignore_keys, validate);
  if (errors?.length) {
    throw new ValidationErrors(errors, config.file);
  }
  return interpolated_config;
};
