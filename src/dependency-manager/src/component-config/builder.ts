/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { flattenValidationErrorsWithLineNumbers } from '../utils/errors';
import { ComponentConfig } from './base';
import { ComponentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No environment config file found at ${filepath}`;
  }
}

export class ComponentConfigBuilder {
  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'architect.json'),
      path.join(input, 'architect.yml'),
      path.join(input, 'architect.yaml'),
    ];
  }

  static async buildFromPath(input: string): Promise<ComponentConfig> {
    const try_files = ComponentConfigBuilder.getConfigPaths(input);

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

    // Transform to component syntax
    if (!js_obj.services) {
      js_obj = {
        name: js_obj.name,
        services: { [js_obj.name]: js_obj },
      };
    }

    try {
      const config = ComponentConfigBuilder.buildFromJSON(js_obj);
      await config.validateOrReject({ groups: ['developer'] });
      // TODO
      // config.setExtends(`file:${input}`);
      return config;
    } catch (err) {
      console.log('Invalid service config:', input);
      throw new Error(JSON.stringify(flattenValidationErrorsWithLineNumbers(err, file_contents), null, 2));
    }
  }

  static buildFromJSON(obj: object): ComponentConfig {
    return plainToClass(ComponentConfigV1, obj);
  }

  static saveToPath(config_path: string, config: ComponentConfig) {
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
