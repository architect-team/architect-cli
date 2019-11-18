import { plainToClass, Transform } from 'class-transformer';
import fs from 'fs-extra';
import path from 'path';
import ARCHITECTPATHS from '../../paths';
import MANAGED_PATHS from '../managed-paths';
import { Default, Dict } from '../utils/transform';
import { SemvarValidator, ServiceNameValidator } from '../utils/validation';
import ServiceApiConfig from './api';
import ServiceDatastoreConfig from './datastore';
import ServiceParameterConfig from './parameter';
import ServiceSubscriptions from './subscriptions';

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
  host?: string;
  version?: string;
  port?: string;

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

  get full_name() {
    return `${this.name}:${this.version}`;
  }

  static loadJSONFromPath(filepath: string): any {
    const config_path = path.join(filepath, MANAGED_PATHS.ARCHITECT_JSON);
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(filepath);
    }
    return require(config_path);
  }

  static parsePathFromDependencyIdentifier(
    dependency_identifier: string,
    path_prefix?: string,
  ) {
    if (dependency_identifier.indexOf('file:') === 0) {
      return path_prefix ?
        path.join(path_prefix, dependency_identifier.slice(5)) :
        path.resolve(dependency_identifier.slice(5));
    }

    throw new UnsupportedDependencyIdentifierError(dependency_identifier);
  }

  setDependencies(dependencies: { [s: string]: string }) {
    this.dependencies = {};
    const validator = new SemvarValidator();
    for (const [dependency, version] of Object.entries(dependencies || {})) {
      if (!ServiceNameValidator.test(dependency)) {
        throw new InvalidConfigFileError(`Invalid dependency "${dependency}" in architect.json. Name must consist of lower case alphanumeric characters, '-' or '/', and must start and end with an alphanumeric character`);
      } else if (!validator.test(version) && version.indexOf('file:') !== 0) {
        throw new InvalidConfigFileError(`Invalid dependency version "${version}" for "${dependency}" in architect.json.`);
      } else {
        this.dependencies[dependency] = version;
      }
    }
    return this;
  }
}

class MissingConfigFileError extends Error {
  constructor(filepath: string) {
    super();
    this.name = 'missing_config_file';
    this.message = `No config file found at ${filepath}`;
  }
}

export class UnsupportedDependencyIdentifierError extends TypeError {
  constructor(identifier: string) {
    super();
    this.name = 'unsupported_dependency_identifier';
    this.message = `Unsupported dependency identifier format: ${identifier}`;
  }
}

class InvalidConfigFileError extends Error {
  name = 'invalid_config_file';
}
