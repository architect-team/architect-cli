/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
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
    let file_contents;

    try {
      const data = fs.lstatSync(config_path);
      if (data.isFile()) {
        file_contents = fs.readFileSync(config_path, 'utf-8');
      }
    } catch { }

    if (!file_contents) {
      throw new MissingConfigFileError(config_path);
    }

    // Try to parse as json
    let js_obj;
    try {
      js_obj = JSON.parse(file_contents);
      return EnvironmentConfigBuilder.buildFromJSON(js_obj);
    } catch {
      try {
        // Try to parse as yaml
        js_obj = yaml.safeLoad(file_contents);
      } catch { }
    }

    if (!js_obj) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    try {
      const env_config = EnvironmentConfigBuilder.buildFromJSON(js_obj);
      env_config.validateOrRejectSync({ groups: ['operator'] });
      return env_config;
    } catch (err) {
      console.log('Invalid environment config:', config_path);
      throw err;
    }
  }

  static buildFromJSON(obj: object): EnvironmentConfig {
    return plainToClass(EnvironmentConfigV1, obj);
  }

  static saveToPath(config_path: string, config: EnvironmentConfig) {
    if (config_path.endsWith('.json')) {
      fs.writeJsonSync(config_path, config, { spaces: 2 });
      return;
    } else if (config_path.endsWith('.yml') || config_path.endsWith('.yaml')) {
      fs.writeFileSync(config_path, yaml.safeDump(config));
      return;
    }

    throw new Error(`Cannot save config to invalid path: ${config_path}`);
  }
}
