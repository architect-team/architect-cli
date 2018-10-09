import SUPPORTED_LANGUAGE from './supported-languages';
import {SemvarValidator} from './validation-utils';

export default class ServiceConfig {
  static loadFromFile(filepath: string) {
    const configJSON = require(filepath);
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

  name: string;
  version: string;
  description: string;
  keywords: string[];
  author: string;
  license: string;
  dependencies: object;
  proto?: string;
  main: string;
  language: SUPPORTED_LANGUAGE;

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
    this.language = SUPPORTED_LANGUAGE.JAVASCRIPT;
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

  setDependencies(dependencies: object) {
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

  setLanguage(language: SUPPORTED_LANGUAGE) {
    this.language = language;
    return this;
  }
}
