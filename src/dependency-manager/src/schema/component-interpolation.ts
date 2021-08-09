import { interpolateString } from '../utils/interpolation';
import { parseSourceYml } from './component-builder';
import { ComponentConfig } from './config/component-config';
import { validateOrRejectConfig } from './config/component-validator';
import { validateOrRejectSpec } from './spec-validator';
import { transformComponentSpec } from './spec/transform/component-transform';


export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[]): ComponentConfig => {
  const interpolated_component_string = interpolateString(config.source_yml, config.context, ignore_keys);
  const parsed_yml = parseSourceYml(interpolated_component_string);
  const spec = validateOrRejectSpec(parsed_yml);
  const interpolated_component_config = transformComponentSpec(spec, config.source_yml);
  validateOrRejectConfig(interpolated_component_config);
  return interpolated_component_config;
};
