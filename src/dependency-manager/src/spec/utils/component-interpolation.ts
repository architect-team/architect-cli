
/* TODO:333
export const interpolateConfig = (config: ComponentConfig, ignore_keys: string[], validate = true): { interpolated_config: ComponentConfig; errors: ValidationError[] } => {
  const { errors, interpolated_obj } = interpolateObject(config, config.context, ignore_keys);

  if (validate && errors.length) {
    return { interpolated_config: config, errors };
  }

  // TODO:288:
  // Interpolate component context so other components can ref dependency contexts for interpolation
  // if we error here, we won't provide correct line numbers
  // we can potentially map it back to original source_yml
  // goal: get the path from the context interpolation error
  const { interpolated_obj: interpolated_context, errors: interpolate_errors } = interpolateObject(config.context, config.context, ignore_keys);
  if (validate && errors.length) {
    return { interpolated_config: config, errors: interpolate_errors };
  }
  config.context = interpolated_context as ComponentContext;

  const parsed_yml = parseSourceYml(interpolated_string);
  const spec_errors = validate ? validateSpec(parsed_yml) : [];
  if (spec_errors?.length) {
    return { interpolated_config: config, errors: spec_errors };
  }
  const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, config.source_yml, config.tag, config.metadata);
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
*/
