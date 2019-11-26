import { EnvironmentConfig, EnvironmentService, EnvironmentVault } from './base';

interface VaultMap {
  [vault_name: string]: {
    type: string;
    host: string;
    description?: string;
    access_token: string;
  };
}

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
  vaults: VaultMap = {};

  getServices(): { [key: string]: EnvironmentService } {
    // This seems silly now, but it's important in case we ever make breaking
    // config changes
    return this.services;
  }

  getVaults(): { [key: string]: EnvironmentVault } {
    return this.vaults;
  }
}
