import ServiceConfig from '../common/service-config';

export default interface IDeployer {
  service_config: ServiceConfig;

  /**
   * Deploy the service
   * @returns [status: boolean, pid?: string]
   */
  deploy(): [boolean, string?];
}
