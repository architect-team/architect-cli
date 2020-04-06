import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import path from 'path';
import { ServiceConfig } from './base';
import { ServiceConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No config file found at ${filepath}`;
  }
}

export class ServiceConfigBuilder {
  static CONFIG_FILENAME = 'architect.json';

  static buildFromPath(service_path: string): ServiceConfig {
    let config_path = service_path;
    if (!service_path.endsWith('.json')) {
      config_path = path.join(service_path, ServiceConfigBuilder.CONFIG_FILENAME);
    }
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(config_path);
    }
    const configPayload = fs.readJSONSync(config_path) as object;
    return ServiceConfigBuilder.buildFromJSON(configPayload);
  }

  static buildFromJSON(obj: object): ServiceConfig {
    return plainToClass(ServiceConfigV1, obj);
  }

  static saveToPath(service_path: string, config: ServiceConfig) {
    let config_path = service_path;
    if (!service_path.endsWith('.json')) {
      config_path = path.join(service_path, ServiceConfigBuilder.CONFIG_FILENAME);
    }
    fs.writeJSONSync(config_path, config, {
      spaces: 2,
    });
  }
}
