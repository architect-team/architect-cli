import ServiceConfig from '../common/service-config';

import IDeployer from './ideployer';

export default class LocalDeployer implements IDeployer {
  service_config: ServiceConfig;
  service_path: string;

  constructor(service_path: string) {
    this.service_config = ServiceConfig.loadFromPath(service_path);
    this.service_path = service_path;
  }

  deploy(): [boolean, string] {
    return [false, ''];
  }
}
