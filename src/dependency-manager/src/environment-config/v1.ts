import { EnvironmentConfig, DebugConfig, EnvironmentService } from './base';

interface ServiceMap {
  [service_ref: string]: {
    host?: string;
    port?: number;
    parameters: {
      [key: string]: string;
    };
    datastores: {
      [key: string]: {
        host?: string;
        port?: number;
        parameters: {
          [key: string]: string;
        };
      };
    };
    debug?: {
      path: string;
    };
  };
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  services: ServiceMap = {};

  getServices(): { [key: string]: EnvironmentService } {
    // This seems silly now, but it's important in case we ever make breaking
    // config changes
    return this.services;
  }
}
