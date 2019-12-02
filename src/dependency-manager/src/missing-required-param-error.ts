export default class MissingRequiredParamError extends Error {
  constructor(
    param_name: string,
    param_description: string,
    service_name: string,
  ) {
    super();
    this.name = 'missing_required_param';
    this.message = `Missing required parameter for '${service_name}':\n` +
      `  ${param_name} - ${param_description}`;
  }
}
