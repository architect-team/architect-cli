import { EnvironmentConfig } from './base';

interface DatastoreConfigV1 {
  host?: string;
  port?: number;
  parameters: {
    [key: string]: string;
  };
}

interface ServiceConfigV1 {
  host?: string;
  port?: number;
  parameters: {
    [key: string]: string;
  };
  datastores: {
    [key: string]: DatastoreConfigV1;
  };
}

export class EnvironmentConfigV1 extends EnvironmentConfig {
  services: { [service_ref: string]: ServiceConfigV1 } = {};

  getServiceParameters(service_ref: string): { [key: string]: string } {
    const ref = Object.keys(this.services).find(key => key.startsWith(service_ref));
    if (ref) {
      return this.services[ref].parameters;
    }

    return {};
  }

  getDatastoreParameters(service_ref: string, datastore_name: string): { [key: string]: string } {
    const ref = Object.keys(this.services).find(key => key.startsWith(service_ref));
    if (ref && Object.keys(this.services[ref].datastores).hasOwnProperty(datastore_name)) {
      return this.services[ref].datastores[datastore_name].parameters;
    }

    return {};
  }
}
