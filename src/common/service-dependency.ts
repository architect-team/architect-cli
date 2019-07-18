import execa = require('execa');
import { readFileSync } from 'fs';
import path from 'path';
import url from 'url';

import { AppConfig } from '../app-config';

import ServiceConfig from './service-config';
import { SemvarValidator } from './validation-utils';

export default abstract class ServiceDependency {
  static create(app_config: AppConfig, service_path: string, _root = true) {
    if (ServiceDependency._cache[service_path]) {
      return ServiceDependency._cache[service_path];
    }

    const validator = new SemvarValidator();
    const service_version = service_path.split(':')[service_path.split(':').length - 1];
    const valid_version = service_version && validator.test(service_version);

    let service_dependency;
    if (valid_version) {
      service_dependency = new DockerServiceDependency(app_config, service_path, _root);
    } else {
      service_dependency = new LocalServiceDependency(app_config, path.resolve(service_path), _root);
    }

    ServiceDependency._cache[service_path] = service_dependency;
    return service_dependency;
  }

  private static readonly _cache: { [s: string]: ServiceDependency } = {};

  readonly app_config: AppConfig;
  readonly service_path: string;
  readonly root: boolean;
  local = false;
  protected _config!: ServiceConfig;
  protected _proto?: string;
  protected _loaded: boolean;

  constructor(app_config: AppConfig, service_path: string, _root: boolean) {
    this.app_config = app_config;
    this.service_path = service_path;
    this.root = _root;
    this._loaded = false;
  }

  get config(): ServiceConfig {
    if (!this._config) {
      throw new Error(`Not loaded ${this.service_path}`);
    }
    return this._config;
  }

  get proto(): string | undefined {
    if (!this._config) {
      throw new Error(`Not loaded ${this.service_path}`);
    }
    return this._proto;
  }

  get dependencies(): ServiceDependency[] {
    const service_dependencies: ServiceDependency[] = [];
    Object.keys(this.config.dependencies).forEach(dependency_name => {
      let dependency_path = this.config.dependencies[dependency_name];
      const local = dependency_path.startsWith('file:');
      if (local) {
        dependency_path = ServiceConfig.parsePathFromDependencyIdentifier(dependency_path, this.service_path);
      } else {
        dependency_path = `${dependency_name}:${dependency_path}`;
      }
      service_dependencies.push(ServiceDependency.create(this.app_config, dependency_path, false));
    });
    return service_dependencies;
  }

  get all_dependencies(): ServiceDependency[] {
    const service_dependencies: ServiceDependency[] = [];
    let queue: ServiceDependency[] = [this];
    while (queue.length > 0) {
      const service_dependency = queue.shift()!;
      if (service_dependencies.indexOf(service_dependency) < 0) {
        service_dependencies.unshift(service_dependency);
        queue = queue.concat(service_dependency.dependencies);
      }
    }
    return service_dependencies;
  }

  get local_dependencies(): ServiceDependency[] {
    const service_dependencies: ServiceDependency[] = [];
    let queue: ServiceDependency[] = [this];
    while (queue.length > 0) {
      const service_dependency = queue.shift()!;
      if (service_dependencies.indexOf(service_dependency) < 0 && service_dependency.local) {
        service_dependencies.unshift(service_dependency);
        queue = queue.concat(service_dependency.dependencies);
      }
    }
    return service_dependencies;
  }

  async load() {
    if (this._loaded) {
      return;
    }
    await this._load();
    this._loaded = true;
  }

  abstract async _load(): Promise<void>;
  abstract get tag(): string;
}

class LocalServiceDependency extends ServiceDependency {
  local = true;

  get tag() {
    return `architect-${this.config.full_name}`;
  }

  async _load() {
    this._config = ServiceConfig.loadFromPath(this.service_path);
    if (this.config.proto) {
      this._proto = readFileSync(path.join(this.service_path, this.config.proto)).toString('utf-8');
    }
  }
}

class DockerServiceDependency extends ServiceDependency {
  get tag() {
    return url.resolve(`${this.app_config.default_registry_host}/`, `${this.config.full_name}`);
  }

  async _load() {
    const default_registry_host = this.app_config.default_registry_host;
    const repository_name = url.resolve(`${default_registry_host}/`, this.service_path);
    try {
      await this._load_config(repository_name);
    } catch {
      await execa('docker', ['pull', repository_name]);
      await this._load_config(repository_name);
    }
  }

  async _load_config(repository_name: string) {
    const { stdout } = await execa('docker', ['inspect', repository_name, '--format', '{{ index .Config.Labels "architect.json"}}']);
    this._config = ServiceConfig.create(JSON.parse(stdout));
    if (this.config.proto) {
      // TODO write to label on image?
      const proto_res = await execa('docker', ['run', '--rm', repository_name, 'cat', this.config.proto]);
      this._proto = proto_res.stdout;
    }
  }
}
