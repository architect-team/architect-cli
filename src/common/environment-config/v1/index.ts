import { Transform } from 'class-transformer';
import { Dict, Default } from '../../utils/transform';
import EnvironmentConfig from '../index';

export class EnvironmentDatastoreConfig {
  host?: string;
  port?: number;
  @Default({})
  parameters: {
    [key: string]: string;
  } = {};
}

export class EnvironmentServiceConfig {
  host?: string;
  port?: number;
  @Default({})
  parameters: {
    [key: string]: string;
  } = {};
  @Transform(Dict(() => EnvironmentDatastoreConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  datastores: {
    [key: string]: EnvironmentDatastoreConfig;
  } = {};
}

export default class EnvironmentConfigV1 extends EnvironmentConfig {
  @Transform(Dict(() => EnvironmentServiceConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  services: { [service_ref: string]: EnvironmentServiceConfig } = {};

  getServiceParameters(service_ref: string): { [key: string]: string } {
    const ref = Object.keys(this.services).find(key => key.startsWith(service_ref));
    if (ref) {
      return this.services[ref].parameters;
    }

    return {};
  }

  getDatastoreParameters(service_ref: string, datastore_name: string): { [key: string]: string } {
    const ref = Object.keys(this.services).find(key => key.startsWith(service_ref));
    if (!ref) {
      throw new Error(`Invalid service reference: ${service_ref}`);
    }

    if (Object.keys(this.services[ref].datastores).hasOwnProperty(datastore_name)) {
      return this.services[ref].datastores[datastore_name].parameters;
    }

    return {};
  }
}
