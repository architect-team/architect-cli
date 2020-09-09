/* eslint-disable no-empty */
import { plainToClass } from 'class-transformer';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import path from 'path';
import { RawComponentConfig } from '../component-config/builder';
import { Dictionary } from '../utils/dictionary';
import { flattenValidationErrorsWithLineNumbers, ValidationErrors } from '../utils/errors';
import { insertFileDataFromRefs } from '../utils/files';
import { EnvironmentConfig } from './base';
import { EnvironmentConfigV1 } from './v1';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No environment config file found at ${filepath}`;
  }
}

//TODO:213: These are temporary types while we figure out how to resolve the issue of typed raw configs
export interface RawEnvironmentConfig {
  interfaces?: Dictionary<any>;
  components: Dictionary<RawComponentConfig | string>;
}

export class EnvironmentConfigBuilder {

  static readFromPath(config_path: string): [string, RawEnvironmentConfig] {
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

    const updated_file_contents = insertFileDataFromRefs(file_contents, config_path, config_path);

    // Try to parse as json
    let js_obj;
    try {
      js_obj = JSON.parse(updated_file_contents);
    } catch {
      try {
        // Try to parse as yaml
        js_obj = yaml.safeLoad(updated_file_contents);
      } catch { }
    }

    if (!js_obj) {
      throw new Error('Invalid file format. Must be json or yaml.');
    }

    return [updated_file_contents, js_obj];
  }

  static async buildFromPath(config_path: string): Promise<EnvironmentConfig> {
    const [file_contents, js_obj] = EnvironmentConfigBuilder.readFromPath(config_path);

    try {
      const env_config = EnvironmentConfigBuilder.buildFromJSON(js_obj);
      await env_config.validateOrReject({ groups: ['operator'] });

      for (const [component_key, component] of Object.entries(env_config.getComponents())) {
        const component_extends = component.getExtends();
        if (component_extends?.startsWith('file:')) {
          const component_path = component_extends.substr('file:'.length);
          const resolved_component_path = path.resolve(path.dirname(config_path), component_path);
          component.setExtends(`file:${resolved_component_path}`);

          // Load local component config inline into env config
          /*
          const local_component = await ComponentConfigBuilder.buildFromPath(resolved_component_path);
          const prefixed_string = prefixExpressions(serialize(local_component), `components.${normalizeInterpolation(component_key)}`);
          const prefixed_local_component = deserialize(local_component.getClass(), prefixed_string);
          env_config.setComponent(component_key, prefixed_local_component.merge(component));
          */
          env_config.setComponent(component_key, component);
        }
      }

      return env_config;
    } catch (err) {
      throw new ValidationErrors(config_path, flattenValidationErrorsWithLineNumbers(err, file_contents));
    }
  }

  static buildFromJSON(plain_obj: any): EnvironmentConfig {
    if (!(plain_obj instanceof Object)) {
      throw new Error('Object required to build from JSON');
    }

    for (const key of Object.keys(plain_obj)) {
      if (key.startsWith('.')) {
        delete plain_obj[key];
      }
    }
    return plainToClass(EnvironmentConfigV1, plain_obj);
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
