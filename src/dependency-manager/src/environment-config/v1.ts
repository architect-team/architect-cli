import { Transform } from 'class-transformer/decorators';
import { EnvironmentService } from '../environment-service/base';
import { EnvironmentServiceV1 } from '../environment-service/v1';
import { Dict } from '../utils/transform';
import { EnvironmentConfig, EnvironmentParameters, EnvironmentVault } from './base';

interface VaultMap {
  [vault_name: string]: {
    type: string;
    host: string;
    description?: string;
    client_token?: string;
    role_id?: string;
    secret_id?: string;
  };
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  __version = '1.0.0';
  parameters: EnvironmentParameters = {};
  @Transform(Dict(() => EnvironmentServiceV1), { toClassOnly: true })
  services: { [service_ref: string]: EnvironmentService } = {};
  vaults: VaultMap = {};

  getParameters(): EnvironmentParameters {
    return this.parameters;
  }

  getServices(): { [key: string]: EnvironmentService } {
    return this.services;
  }

  getVaults(): { [key: string]: EnvironmentVault } {
    return this.vaults;
  }
}
