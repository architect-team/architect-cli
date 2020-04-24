import fs from 'fs';
import yaml from 'js-yaml';
import { BaseServiceConfig } from './base-configs/service-config';
import { ServiceSpecV1 } from './v1-spec/developer-service';
import { OperatorServiceSpecV1 } from './v1-spec/operator-service';

export class ServiceBuilder {
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
    let obj: any;
    if (filepath.endsWith('.json')) {
      try {
        obj = JSON.parse(file_contents);
      // eslint-disable-next-line no-empty
      } catch { }
    }

    // Try to parse as yaml
    try {
      obj = yaml.safeLoad(file_contents);
    // eslint-disable-next-line no-empty
    } catch { }

    if (obj) {
      return ServiceBuilder.parseAndValidate(obj);
    }

    throw new Error('Invalid file format. Must be json or yaml.');
  }

  static async parseAndValidate(obj: object): Promise<BaseServiceConfig> {
    const res = new ServiceSpecV1(obj);
    await res.validateOrReject();
    return res;
  }

  static create(): BaseServiceConfig {
    return new OperatorServiceSpecV1();
  }
}
