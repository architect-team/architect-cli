import { DatastoreValueFromParameter, ValueFromParameter } from '../../manager';
import { ServiceConfig } from '../../service-config/base';

export interface DependencyNodeOptions {
  image?: string;
  tag?: string;
  host?: string;
  ports: {
    target: string | number;
    expose: string | number;
  };
  service_config: ServiceConfig;
  parameters?: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
}

export abstract class DependencyNode implements DependencyNodeOptions {
  tag: string;
  host: string;
  ports: { target: string | number; expose: string | number };
  service_config: ServiceConfig;
  parameters: { [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter };
  image?: string;

  protected constructor(options: DependencyNodeOptions) {
    this.ports = options.ports;
    this.image = options.image;
    this.host = options.host || '0.0.0.0';
    this.tag = options.tag || 'latest';
    this.parameters = options.parameters || {};
    this.service_config = options.service_config;
  }

  get name() {
    return this.service_config.getName();
  }

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  get ref() {
    return `${this.service_config.getName()}:${this.tag}`;
  }

  equals(node: DependencyNode) {
    return this.ref === node.ref;
  }

  get protocol() {
    return '';
  }
}
