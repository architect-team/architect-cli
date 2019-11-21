import path from 'path';
import fs from 'fs-extra';
import { plainToClass } from 'class-transformer';
import { ServiceConfigV1 } from './v1';
import { ServiceConfig } from './base';

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
    const config_path = path.join(service_path, ServiceConfigBuilder.CONFIG_FILENAME);
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
    const configPath = path.join(service_path, ServiceConfigBuilder.CONFIG_FILENAME);
    fs.writeJSONSync(configPath, config, {
      spaces: 2,
    });
  }
}
