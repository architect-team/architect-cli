import yaml from 'js-yaml';
import { ValidationError } from '../utils/errors';
import { interpolateString } from '../utils/interpolation';
import { parseSourceYml } from './component-builder';
import { ComponentConfig } from './config/component-config';
import { validateConfig } from './config/component-validator';
import { validateSpec } from './spec-validator';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec } from './spec/transform/component-transform';

export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[], validate = true): { interpolated_config: ComponentConfig; errors: ValidationError[] } => {
  if (validate) {
    // TODO:269 talk to Dan
    // Interpolate component context so other components can ref dependency contexts for interpolation
    const interpolated_context = yaml.load(interpolateString(yaml.dump(config.context), config.context, ignore_keys)) as any;
    config.context = interpolated_context;
  }
  const interpolated_component_string = interpolateString(config.source_yml, config.context, ignore_keys);
  const parsed_yml = parseSourceYml(interpolated_component_string);
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
    throw new Error(JSON.stringify(errors, null, 2));
  }
  return interpolated_config;
};
