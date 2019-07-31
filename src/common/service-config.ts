import fs from 'fs';
import path from 'path';
import MANAGED_PATHS from './managed-paths';
import ServiceParameter from './service-parameter';
import SUPPORTED_LANGUAGES from './supported-languages';
import { EnvNameValidator, SemvarValidator, ServiceNameValidator } from './validation-utils';

export default class ServiceConfig {
  static _require(path: string) {
    return require(path);
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

  static loadJSONFromPath(filepath: string): any {
    const config_path = path.join(filepath, MANAGED_PATHS.ARCHITECT_JSON);
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(filepath);
    }
    return ServiceConfig._require(config_path);
  }

  static loadFromPath(filepath: string): ServiceConfig {
    const config_json = ServiceConfig.loadJSONFromPath(filepath);
    return ServiceConfig.create(config_json);
  }

  static writeToPath(filepath: string, config_json: object) {
    const config_path = path.join(filepath, MANAGED_PATHS.ARCHITECT_JSON);
    fs.writeFileSync(config_path, JSON.stringify(config_json, null, 2));
  }

  static create(configJSON: any) {
    return (new ServiceConfig())
      .setName(configJSON.name)
      .setVersion(configJSON.version)
      .setDescription(configJSON.description)
      .setKeywords(configJSON.keywords)
      .setAuthor(configJSON.author)
      .setLicense(configJSON.license)
      .setDependencies(configJSON.dependencies)
      .setParameters(configJSON.parameters)
      .setInterface(configJSON.interface)
      .setDatastores(configJSON.datastores)
      .setMainFile(configJSON.main)
      .setLanguage(configJSON.language)
      .setDebug(configJSON.debug);
  }

  static convertServiceNameToFolderName(service_name: string): string {
    return service_name.replace(/-/g, '_');
  }

  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
  license: string;
  dependencies: { [s: string]: string };
  parameters: { [s: string]: ServiceParameter } = {};
  interface?: { type: string, definitions: string[] };
  datastores: { [key: string]: { image: string, port: string, parameters: { [key: string]: ServiceParameter }, host?: string } };
  main: string;
  language: SUPPORTED_LANGUAGES;
  debug?: string;

  constructor() {
    this.name = '';
    this.version = '0.1.0';
    this.description = '';
    this.keywords = [];
    this.author = '';
    this.license = 'ISC';
    this.dependencies = {};
    this.datastores = {};
    this.main = 'index.js';
    this.language = SUPPORTED_LANGUAGES.NODE;
  }

  get full_name() {
    return `${this.name}:${this.version}`;
  }

  get slug() {
    return this.name
      .replace(/\//g, '__')
      .replace(/-/g, '_');
  }

  getNormalizedName() {
    return ServiceConfig.convertServiceNameToFolderName(this.name).replace(/\//g, '__');
  }

  setName(name: string) {
    name = name.toLowerCase();
    if (ServiceNameValidator.test(name)) {
      this.name = name;
    } else {
      throw new InvalidConfigFileError(`Invalid name "${name}" in architect.json. Name must consist of lower case alphanumeric characters, '-' or '/', and must start and end with an alphanumeric character`);
    }
    return this;
  }

  setVersion(version: string) {
    const validator = new SemvarValidator();
    if (validator.test(version)) {
      this.version = version;
    } else {
      throw new InvalidConfigFileError(`Invalid version "${version}" in architect.json.`);
    }
    return this;
  }

  setDescription(description: string) {
    this.description = description;
    return this;
  }

  setKeywords(keywords: string | string[]) {
    if (typeof keywords === 'string') {
      keywords = keywords.split(',');
    }
    this.keywords = keywords;
    return this;
  }

  setAuthor(author: string) {
    this.author = author;
    return this;
  }

  setLicense(license: string) {
    this.license = license;
    return this;
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

  setParameters(parameters: { [s: string]: Partial<ServiceParameter> }) {
    this.parameters = {};
    for (const [key, env] of Object.entries(parameters || {})) {
      if (EnvNameValidator.test(key)) {
        this.parameters[key] = new ServiceParameter(env);
      } else {
        throw new InvalidConfigFileError(`Invalid parameter "${key}" in architect.json.`);
      }
    }
    return this;
  }

  setInterface(service_interface: { type: string, definitions: string[] }) {
    this.interface = service_interface;
    return this;
  }

  setDatastores(datastores: { [key: string]: { image: string, port: string, parameters: { [key: string]: ServiceParameter }, host?: string } }) {
    this.datastores = datastores || {};
    for (const [ds_key, datastore] of Object.entries(this.datastores)) {
      if (!EnvNameValidator.test(ds_key)) {
        throw new InvalidConfigFileError(`Invalid datastore name "${ds_key}" in architect.json.`);
      }
      if (!datastore.image) {
        throw new InvalidConfigFileError(`Invalid datastore "${ds_key}" has no image in architect.json.`);
      }
      if (!datastore.port) {
        throw new InvalidConfigFileError(`Invalid datastore "${ds_key}" has no port in architect.json.`);
      }
      for (const key of Object.keys(datastore.parameters || {})) {
        if (!EnvNameValidator.test(key)) {
          throw new InvalidConfigFileError(`Invalid parameter "${key}" in datastore "${ds_key}" in architect.json.`);
        }
      }
    }
    return this;
  }

  setMainFile(main_file: string) {
    this.main = main_file;
    return this;
  }

  setLanguage(language: SUPPORTED_LANGUAGES) {
    this.language = language;
    return this;
  }

  setDebug(debug: string) {
    this.debug = debug;
    return this;
  }

  // Indicates whether or not this configuration exposes a new
  // architect service that can be called as a dependency or if
  // its simply a script to be called once.
  isScript() {
    return !this.interface;
  }
}

export class MissingConfigFileError extends Error {
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
