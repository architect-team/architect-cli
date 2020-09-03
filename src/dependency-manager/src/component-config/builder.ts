
/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import untildify from 'untildify';
import { Dictionary } from '../utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../utils/errors';
import { ComponentConfig } from './base';
import { ComponentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No component config file found at ${filepath}`;
  }
}

//TODO:213: These are temporary types while we figure out how to resolve the issue of typed raw configs
export interface RawComponentConfig {
  name: string;
  services: Dictionary<RawServiceConfig>;
  extends?: string;
}

export interface RawServiceConfig {
  name: string;
  build?: {
    context?: string;
  };
  image?: string;
  [key: string]: any;
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

  static readFromPath(input: string): [string, string] {
    const try_files = ComponentConfigBuilder.getConfigPaths(input);

    // Make sure the file exists
    let file_path;
    let file_contents;
    for (const file of try_files) {
      try {
        const data = fs.lstatSync(file);
        if (data.isFile()) {
          file_contents = fs.readFileSync(file, 'utf-8');
          file_path = file;
          break;
        }
      } catch {
        continue;
      }
    }

    if (!file_contents || !file_path) {
      throw new MissingConfigFileError(input);
    }

    return [file_path, file_contents];
  }

  static async rawFromPath(config_path: string): Promise<{ file_path: string; file_contents: string; raw_config: RawComponentConfig }> {
    const [file_path, file_contents] = ComponentConfigBuilder.readFromPath(config_path);

    let updated_file_contents = file_contents;
    if (file_path.endsWith('.yml') || file_path.endsWith('.yaml')) {
      const file_regex = new RegExp('^(?!extends)[a-zA-Z_]+:[\\s+](file:.*\\..*)', 'gm');
      let matches;
      while ((matches = file_regex.exec(updated_file_contents)) != null) {
        const file_path = untildify(matches[1].slice('file:'.length));
        const file_data = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8').trim();
        updated_file_contents = updated_file_contents.replace(matches[1], file_data);
      }
    } else if (file_path.endsWith('json')) {
      updated_file_contents = JSON.stringify(JSON.parse(updated_file_contents), null, 2);
      const file_regex = new RegExp('^(?!.*"extends).*(file:.*\\..*)"$', 'gm');
      let matches;
      while ((matches = file_regex.exec(updated_file_contents)) != null) {
        const file_path = untildify(matches[1].slice('file:'.length));
        const file_data = fs.readFileSync(path.resolve(path.dirname(config_path), file_path), 'utf-8').trim();
        updated_file_contents = updated_file_contents.replace(matches[1], file_data);
      }
    }

    let raw_config;
    // Try to parse as json
    try {
      raw_config = JSON.parse(updated_file_contents);
    } catch {
      // Try to parse as yaml
      try {
        raw_config = yaml.safeLoad(updated_file_contents);
      } catch { }
    }

    if (!raw_config) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    return { file_path, file_contents: updated_file_contents, raw_config };
  }

  static async buildFromPath(path: string): Promise<ComponentConfig> {
    const { file_path, file_contents, raw_config } = await ComponentConfigBuilder.rawFromPath(path);

    try {
      // TODO: Figure out how to enforce services block for components during registration
      const config = ComponentConfigBuilder.buildFromJSON(raw_config);
      await config.validateOrReject({ groups: ['developer'] });
      return config;
    } catch (err) {
      throw new ValidationErrors(file_path, flattenValidationErrorsWithLineNumbers(err, file_contents));
    }
  }

  static buildFromJSON(obj: any): ComponentConfig {
    if (!(obj instanceof Object)) {
      throw new Error('Object required to build from JSON');
    }
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
