import ServiceParameterConfig from '../service-config/parameter';
import { __param } from 'tslib';

export default class MissingRequiredParamError extends Error {
  constructor(param_name: string, param: ServiceParameterConfig, service_name: string) {
    super();
    this.name = 'missing_required_param';
    this.message = `Missing required parameter for '${service_name}':\n` +
      `  ${param_name} - ${param.description}`;
  }
}
