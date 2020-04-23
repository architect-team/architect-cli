import fs from 'fs';
import yaml from 'js-yaml';
import { BaseEnvironmentConfig } from './base-configs/environment-config';
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
    } catch { }

    if (!file_contents) {
      throw new Error(`Missing or invalid file: ${filepath}`);
    }

    // Try to parse as json
    if (filepath.endsWith('.json')) {
      try {
        const js_obj = JSON.parse(file_contents);
        return EnvironmentBuilder.parseAndValidate(js_obj);
      } catch {}
    }

    // Try to parse as yaml
    try {
      const js_obj = yaml.safeLoad(file_contents);
      return EnvironmentBuilder.parseAndValidate(js_obj);
    } catch {}    

    throw new Error('Invalid file format. Must be json or yaml.');
  }

  static async parseAndValidate(obj: object): Promise<BaseEnvironmentConfig> {
    const res = new EnvironmentSpecV1(obj);
    await res.validateOrReject();
    return res;
  }

  static create(): BaseEnvironmentConfig {
    return new EnvironmentSpecV1();
  }
}