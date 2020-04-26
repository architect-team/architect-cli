import fs from 'fs';
import yaml from 'js-yaml';
import path from 'path';
import { BaseEnvironmentConfig } from './environment-config';
import { EnvironmentSpecV1 } from './v1-spec/environment';

export class EnvironmentBuilder {
  static async loadFromFile(filepath: string) {
    // Make sure the file exists
    let file_contents;
    try {
      const data = fs.lstatSync(filepath);
      if (data.isFile()) {
        file_contents = fs.readFileSync(filepath, 'utf-8');
      }
    // eslint-disable-next-line no-empty
    } catch { }

    if (!file_contents) {
      throw new Error(`Missing or invalid file: ${filepath}`);
    }

    // Try to parse as json
    if (filepath.endsWith('.json')) {
      try {
        const js_obj = JSON.parse(file_contents);
        return EnvironmentBuilder.parseAndValidate(js_obj, filepath);
      // eslint-disable-next-line no-empty
      } catch {}
    }

    // Try to parse as yaml
    try {
      const js_obj = yaml.safeLoad(file_contents);
      return EnvironmentBuilder.parseAndValidate(js_obj, filepath);
    // eslint-disable-next-line no-empty
    } catch {}

    throw new Error('Invalid file format. Must be json or yaml.');
  }

  static async parseAndValidate(obj: object, filepath?: string): Promise<BaseEnvironmentConfig> {
    const res = new EnvironmentSpecV1(obj);

    // Ensure service debug paths are relative to the environment config
    if (filepath) {
      res.getServices().forEach(service => {
        const debug_path = service.getDebugPath();
        if (debug_path) {
          service.setDebugPath(path.join(filepath, debug_path));
          res.addService(service);
        }
      });
    }

    await res.validateOrReject();
    return res;
  }

  static create(): BaseEnvironmentConfig {
    return new EnvironmentSpecV1();
  }
}
