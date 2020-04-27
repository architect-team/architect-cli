/* eslint-disable no-empty */
import { classToClass, plainToClass } from 'class-transformer';
import { ValidatorOptions } from 'class-validator';
import fs from 'fs-extra';
import yaml from 'js-yaml';
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
  static getConfigPaths(input: string) {
    return [
      input,
      path.join(input, 'architect.json'),
      path.join(input, 'architect.yml'),
      path.join(input, 'architect.yaml'),
    ];
  }

  static async buildFromPath(input: string, validatorOptions?: ValidatorOptions): Promise<ServiceConfig> {
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

    // Try to parse as json
    try {
      const js_obj = JSON.parse(file_contents);
      return ServiceConfigBuilder.buildFromJSON(js_obj, validatorOptions);
    } catch {}

    // Try to parse as yaml
    try {
      const js_obj = yaml.safeLoad(file_contents);
      return ServiceConfigBuilder.buildFromJSON(js_obj, validatorOptions);
    } catch {}

    throw new Error('Invalid file format. Must be json or yaml.');
  }

  static async buildFromJSON(obj: object, validateOptions?: ValidatorOptions): Promise<ServiceConfig> {
    const res = plainToClass(ServiceConfigV1, obj, { groups: ['allow-shorthand' ]});
    await res.validateOrReject(validateOptions);
    return classToClass(res, { groups: ['transform-shorthand'] });
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

  static create(): ServiceConfig {
    return new ServiceConfigV1();
  }
}
