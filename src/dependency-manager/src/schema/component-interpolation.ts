import { ValidationError } from '../utils/errors';
import { interpolateString } from '../utils/interpolation';
import { parseSourceYml } from './component-builder';
import { ComponentConfig } from './config/component-config';
import { validateConfig } from './config/component-validator';
import { validateSpec } from './spec-validator';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec } from './spec/transform/component-transform';

export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[]): { interpolated_config: ComponentConfig; errors: ValidationError[] } => {
  const interpolated_component_string = interpolateString(config.source_yml, config.context, ignore_keys);
  const parsed_yml = parseSourceYml(interpolated_component_string);
  const spec_errors = validateSpec(parsed_yml);
  if (spec_errors?.length) {
    // TODO:269 return null for interpolated_config?
    return { interpolated_config: config, errors: spec_errors };
  }
  const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, config.source_yml, config.tag, config.instance_metadata);
  const config_errors = validateConfig(interpolated_component_config);
  return { interpolated_config: interpolated_component_config, errors: config_errors };
};

export const interpolateConfigOrReject = (config: ComponentConfig, ignore_keys: string[]): ComponentConfig => {
  const { interpolated_config, errors } = interpolateConfig(config, ignore_keys);
  if (errors?.length) {
    throw new Error(JSON.stringify(errors, null, 2));
  }
  return interpolated_config;
};
