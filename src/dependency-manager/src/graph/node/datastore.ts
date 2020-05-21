import { DependencyNode, DependencyNodeOptions } from '.';
import { ParameterValue, ServiceDatastore } from '../../service-config/base';

interface DatastoreNodeOptions {
  parent_ref: string;
  key: string;
  node_config: ServiceDatastore;
}

export class DatastoreNode extends DependencyNode {
  __type = 'datastore';
  parent_ref!: string;
  key!: string;

  node_config!: ServiceDatastore;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super();
    if (options) {
      this.parent_ref = options.parent_ref;
      this.key = options.key;
      this.node_config = options.node_config;
    }
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }

  get image() {
    return this.node_config.image;
  }

  get interfaces() {
    return { _default: { host: this.node_config.host, port: this.node_config.port } };
  }

  get parameters() {
    const param_map: { [key: string]: ParameterValue } = {};
    for (const [key, value] of Object.entries(this.node_config.parameters)) {
      if ('default' in value && value.default !== undefined) {
        param_map[key] = value.default;
      }
    }
    return param_map;
  }
}
