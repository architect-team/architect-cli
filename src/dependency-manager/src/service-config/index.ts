import path from 'path';
import fs from 'fs-extra';
import ServiceParameter from './parameter';
import ServiceDatastore from './datastore';
import ServiceApiSpec from './api-spec';

export default abstract class ServiceConfig {
  abstract getName(): string;
  abstract getDependencies(): { [s: string]: string };
  abstract getParameters(): { [s: string]: ServiceParameter };
  abstract getDatastores(): { [s: string]: ServiceDatastore };
  abstract getApiSpec(): ServiceApiSpec;
  abstract isValid(): boolean;

  static CONFIG_FILENAME = 'architect.json';

  static saveToPath(service_path: string, config: ServiceConfig) {
    const configPath = path.join(service_path, ServiceConfig.CONFIG_FILENAME);
    fs.writeJSONSync(configPath, config, {
      spaces: 2,
    });
  }
}
