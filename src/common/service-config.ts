import * as fs from 'fs';
import * as path from 'path';

import MANAGED_PATHS from './managed-paths';
import SUPPORTED_LANGUAGES from './supported-languages';
import { SemvarValidator } from './validation-utils';

interface ServiceDependency {
  service_path: string;
  service_config: ServiceConfig;

  dependencies: ServiceDependency[];
}

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

  static loadFromPath(filepath: string): ServiceConfig {
    const config_path = path.join(filepath, MANAGED_PATHS.ARCHITECT_JSON);
    if (!fs.existsSync(config_path)) {
      throw new MissingConfigFileError(filepath);
    }

    const configJSON = ServiceConfig._require(config_path);
    return (new ServiceConfig())
      .setName(configJSON.name)
      .setVersion(configJSON.version)
      .setDescription(configJSON.description)
      .setKeywords(configJSON.keywords)
      .setAuthor(configJSON.author)
      .setLicense(configJSON.license)
      .setDependencies(configJSON.dependencies)
      .setProto(configJSON.proto)
      .setMainFile(configJSON.main)
      .setLanguage(configJSON.language);
  }

  static async getDependencies(root_service_path: string, recursive?: boolean): Promise<ServiceDependency[]> {
    const service_dependencies: ServiceDependency[] = [];
    const services_map: any = {};

    const root_service_config = ServiceConfig.loadFromPath(root_service_path!);
    services_map[root_service_path] = {
      service_path: root_service_path!,
      service_config: root_service_config,
      dependencies: []
    };
    const queue = [services_map[root_service_path]];

    while (queue.length > 0) {
      const service_dependency = queue.shift()!;
      const service_config = service_dependency.service_config;
      service_dependencies.push(service_dependency);

      if (recursive) {
        const dependency_names = Object.keys(service_config.dependencies);
        for (let dependency_name of dependency_names) {
          const dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(
            service_config.dependencies[dependency_name],
            service_dependency.service_path
          );

          // Handle circular deps
          if (!services_map[dependency_path]) {
            const dependency_config = ServiceConfig.loadFromPath(dependency_path!);
            services_map[dependency_path] = {
              service_path: dependency_path,
              service_config: dependency_config,
              dependencies: []
            };
            queue.push(services_map[dependency_path]);
          }
          service_dependency.dependencies.push(services_map[dependency_path]);
        }
      }
    }

    return service_dependencies;
  }

  static convertServiceNameToFolderName(service_name: string): string {
    return service_name.replace('-', '_');
  }

  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
  license: string;
  dependencies: { [s: string]: string };
  proto?: string;
  main: string;
  language: SUPPORTED_LANGUAGES;

  constructor() {
    this.name = '';
    this.version = '0.1.0';
    this.description = '';
    this.keywords = [];
    this.author = '';
    this.license = 'ISC';
    this.dependencies = {};
    this.proto = undefined;
    this.main = 'index.js';
    this.language = SUPPORTED_LANGUAGES.NODE;
  }

  getNormalizedName() {
    return ServiceConfig.convertServiceNameToFolderName(this.name);
  }

  getProtoName() {
    return this.proto ?
      this.proto.slice(0, this.proto.lastIndexOf('.')) :
      undefined;
  }

  setName(name: string) {
    this.name = name;
    return this;
  }

  setVersion(version: string) {
    const validator = new SemvarValidator();
    if (validator.test(version)) {
      this.version = version;
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
    this.dependencies = dependencies;
    return this;
  }

  setProto(protopath: string) {
    this.proto = protopath;
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

  // Indicates whether or not this configuration exposes a new
  // architect service that can be called as a dependency or if
  // its simply a script to be called once.
  isScript() {
    return !this.proto;
  }
}

export class MissingConfigFileError implements Error {
  name: string;
  message: string;

  constructor(filepath: string) {
    this.name = 'missing_config_file';
    this.message = `No config file found at ${filepath}`;
  }
}

export class UnsupportedDependencyIdentifierError implements TypeError {
  name: string;
  message: string;

  constructor(identifier: string) {
    this.name = 'unsupported_dependency_identifier';
    this.message = `Unsupported dependency identifier format: ${identifier}`;
  }
}
