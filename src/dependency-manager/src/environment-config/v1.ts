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
  __version = '1.0.0';
  services: ServiceMap = {};
  vaults: VaultMap = {};

  getServices(): { [key: string]: EnvironmentService } {
    // Ensure that default, empty objects are populated for necessary service components
    for (const service_ref of Object.keys(this.services)) {
      if (!this.services[service_ref].datastores) {
        this.services[service_ref].datastores = {};
      }

      if (!this.services[service_ref].parameters) {
        this.services[service_ref].parameters = {};
      }
    }

    return this.services;
  }

  getVaults(): { [key: string]: EnvironmentVault } {
    return this.vaults;
  }
}
