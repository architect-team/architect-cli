import { ValidationError } from '../utils/errors';
import { interpolateString } from '../utils/interpolation';
import { parseSourceYml } from './component-builder';
import { ComponentConfig } from './config/component-config';
import { validateConfig, validateOrRejectConfig } from './config/component-validator';
import { validateOrRejectSpec, validateSpec } from './spec-validator';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec } from './spec/transform/component-transform';

export const interpolateConfigOrReject = (config: ComponentConfig, ignore_keys: string[]): ComponentConfig => {
  // TODO:269:remove console.log('source:');
  // TODO:269:remove console.log(config.source_yml);
  // TODO:269:remove console.log('context:');
  // TODO:269:remove console.log(JSON.stringify(config.context));
  const interpolated_component_string = interpolateString(config.source_yml, config.context, ignore_keys);
  // TODO:269:remove console.log('interpolated:');
  // TODO:269:remove console.log(interpolated_component_string);
  const parsed_yml = parseSourceYml(interpolated_component_string);
  const spec = validateOrRejectSpec(parsed_yml);
  // TODO:269:remove console.log('spec:');
  // TODO:269:remove console.log(spec);
  const interpolated_component_config = transformComponentSpec(spec, config.source_yml, config.tag);
  // TODO:269:remove console.log('interpolated:');
  // TODO:269:remove console.log(interpolated_component_config);
  validateOrRejectConfig(interpolated_component_config);
  return interpolated_component_config;
};

export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[]): { interpolated_config: ComponentConfig; errors: ValidationError[] } => {
  const interpolated_component_string = interpolateString(config.source_yml, config.context, ignore_keys);
  const parsed_yml = parseSourceYml(interpolated_component_string);
  const spec_errors = validateSpec(parsed_yml);
  const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, config.source_yml, config.tag);
  const config_errors = validateConfig(interpolated_component_config);
  return { interpolated_config: interpolated_component_config, errors: [...spec_errors, ...config_errors] };
};
