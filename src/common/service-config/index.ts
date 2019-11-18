import path from 'path';
import fs from 'fs-extra';
import ServiceParameterConfig from './parameter';
import ServiceApiConfig from './api';
import ServiceDatastoreConfig from './datastore';
import ServiceSubscriptions from './subscriptions';
import { Transform, plainToClass } from 'class-transformer';
import { Dict, Default } from '../utils/transform';
import ARCHITECTPATHS from '../../paths';

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No config file found at ${filepath}`;
  }
}

export default class ServiceConfig {
  name = '';
  description?: string;
  keywords?: string[];
  dependencies: { [s: string]: string } = {};
  @Transform(Dict(() => ServiceParameterConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  parameters: { [s: string]: ServiceParameterConfig } = {};
  @Transform(Dict(() => ServiceDatastoreConfig, { key: 'value' }), { toClassOnly: true })
  @Default({})
  datastores: { [s: string]: ServiceDatastoreConfig } = {};
  api?: ServiceApiConfig;
  language?: string;
  subscriptions?: ServiceSubscriptions;
  debug?: string;

  constructor(partial?: Partial<ServiceConfig>) {
    Object.assign(this, partial);
  }

  static loadFromPath(service_path: string) {
    const config_path = path.join(service_path, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(config_path);
    }
    const configPayload = fs.readJSONSync(config_path) as object;
    return plainToClass(ServiceConfig, configPayload);
  }

  static saveToPath(service_path: string, config: ServiceConfig) {
    const configPath = path.join(service_path, ARCHITECTPATHS.SERVICE_CONFIG_FILENAME);
    fs.writeJSONSync(configPath, config, {
      spaces: 2,
    });
  }

  getDependencies(): { [s: string]: string } {
    return this.dependencies || {};
  }

  isValid(): boolean {
    return Boolean(
      this.name &&
      this.language &&
      (
        !this.datastores ||
        Object.keys(this.datastores)
          .every(key => this.datastores[key].isValid())
      )
    );
  }
}
