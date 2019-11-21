import ServiceParameter from './parameter';
import ServiceDatastore from './datastore';
import ServiceApiSpec from './api-spec';

export abstract class ServiceConfig {
  abstract getName(): string;
  abstract getDependencies(): { [s: string]: string };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract isValid(): boolean;
}
