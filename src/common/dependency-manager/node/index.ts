import ServiceSubscriptions from '../../service-config/subscriptions';

export interface NodeOptions {
  name: string;
  tag: string;
  host?: string;
  target_port: string | number;
  parameters?: { [key: string]: string };
  subscriptions?: ServiceSubscriptions;
  api_type?: string;
  api_definitions?: string[];
  language?: string;
}

export interface PrivateNodeOptions extends NodeOptions {
  expose_port: number;
}

export default abstract class DependencyNode {
  name: string;
  tag: string;
  host: string;
  target_port: string | number;
  expose_port: string | number;
  parameters: { [key: string]: string };
  subscriptions: ServiceSubscriptions;
  api_type?: string;
  api_definitions?: string[];
  language?: string;
  isDatastore: boolean;

  constructor(options: PrivateNodeOptions) {
    this.name = options.name;
    this.tag = options.tag;
    this.parameters = options.parameters || {};
    this.subscriptions = options.subscriptions || {};
    this.host = options.host || '0.0.0.0';
    this.target_port = options.target_port;
    this.expose_port = options.expose_port;
    this.api_type = options.api_type;
    this.api_definitions = options.api_definitions;
    this.language = options.language;
    this.isDatastore = false;
  }

  get normalized_ref() {
    return this.ref
      .replace(/:/g, '.')
      .replace(/\//g, '.');
  }

  get ref() {
    return `${this.name}:${this.tag}`;
  }

  equals(node: DependencyNode) {
    return this.ref === node.ref;
  }
}
