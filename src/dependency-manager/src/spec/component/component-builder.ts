
/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { Dictionary } from '../../utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../../utils/errors';
import { insertFileDataFromRefs } from '../../utils/files';
import { DeploySpec } from '../common/deploy-spec';
import { ComponentConfig } from './component-config';
import { ComponentConfigV1 } from './component-v1';

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
  tasks: Dictionary<RawServiceConfig>;
  extends?: string;
  artifact_image?: string;
}

export interface RawServiceConfig {
  name: string;
  build?: {
    context?: string;
    dockerfile?: string;
    args?: string[];
  };
  image?: string;
  deploy?: DeploySpec;
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

    let raw_config;
    // Try to parse as json
    try {
      raw_config = JSON.parse(file_contents);
    } catch {
      // Try to parse as yaml
      try {
        raw_config = yaml.safeLoad(file_contents);
      } catch { }
    }

    if (!raw_config) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    raw_config = JSON.parse(insertFileDataFromRefs(JSON.stringify(raw_config, null, 2), file_path));

    return { file_path, file_contents, raw_config };
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

  static buildFromJSON(plain_obj: any): ComponentConfig {
    if (!(plain_obj instanceof Object)) {
      throw new Error('Object required to build from JSON');
    }

    for (const key of Object.keys(plain_obj)) {
      if (key.startsWith('.')) {
        delete plain_obj[key];
      }
    }
    return plainToClass(ComponentConfigV1, plain_obj);
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
