export default class MissingRequiredParamError extends Error {
  constructor(
    param_name: string,
    param_description: string,
    component_name: string,
  ) {
    super();
    this.name = 'missing_required_param';
    this.message = `Missing required parameter for '${component_name}':\n` +
      `  ${param_name} - ${param_description}`;
  }
}
