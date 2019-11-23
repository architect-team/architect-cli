import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import { EnvironmentConfig } from './base';
import { EnvironmentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No environment config file found at ${filepath}`;
  }
}

export class EnvironmentConfigBuilder {
  static buildFromPath(config_path: string): EnvironmentConfig {
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(config_path);
    }
    const configPayload = fs.readJSONSync(config_path) as object;
    return EnvironmentConfigBuilder.buildFromJSON(configPayload);
  }

  static buildFromJSON(obj: object): EnvironmentConfig {
    return plainToClass(EnvironmentConfigV1, obj);
  }

  static saveToPath(config_path: string, config: EnvironmentConfig) {
    fs.writeJSONSync(config_path, config, {
      spaces: 2,
    });
  }
}
