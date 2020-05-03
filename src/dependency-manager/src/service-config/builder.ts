/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { flattenValidationErrors } from '../utils/errors';
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
  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'architect.json'),
      path.join(input, 'architect.yml'),
      path.join(input, 'architect.yaml'),
    ];
  }

  static async buildFromPath(input: string): Promise<ServiceConfig> {
    const try_files = ServiceConfigBuilder.getConfigPaths(input);

    // Make sure the file exists
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents) {
      throw new MissingConfigFileError(input);
    }

    let js_obj;
    // Try to parse as json
    try {
      js_obj = JSON.parse(file_contents);
    } catch {
      // Try to parse as yaml
      try {
        js_obj = yaml.safeLoad(file_contents);
      } catch { }
    }

    if (!js_obj) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    try {
      const config = ServiceConfigBuilder.buildFromJSON(js_obj);
      await config.validateOrReject({ groups: ['developer'] });
      config.setDebugPath(input);
      return config;
    } catch (err) {
      console.log('Invalid service config:', input);
      throw new Error(JSON.stringify(flattenValidationErrors(err), null, 2));
    }
  }

  static buildFromJSON(obj: object): ServiceConfig {
    return plainToClass(ServiceConfigV1, obj);
  }

  static saveToPath(input: string, config: ServiceConfig) {
    const try_files = ServiceConfigBuilder.getConfigPaths(input);

    for (const file of try_files) {
      if (file.endsWith('.json')) {
        fs.writeJsonSync(file, config, { spaces: 2 });
        return;
      } else if (file.endsWith('.yml') || file.endsWith('.yaml')) {
        fs.writeFileSync(file, yaml.safeDump(config));
        return;
      }
    }

    throw new Error(`Cannot save config to invalid path: ${input}`);
  }
}
