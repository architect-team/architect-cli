import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceDatastore } from '../../service-config/base';

interface DatastoreNodeOptions {
  parent_ref: string;
  key: string;
  datastore_config: ServiceDatastore;
  node_config: ServiceDatastore;
}

export class DatastoreNode extends DependencyNode {
  __type = 'datastore';
  parent_ref!: string;
  key!: string;

  datastore_config!: ServiceDatastore;
  node_config!: ServiceDatastore;

  constructor(options: DependencyNodeOptions & DatastoreNodeOptions) {
    super();
    if (options) {
      this.parent_ref = options.parent_ref;
      this.key = options.key;
      this.datastore_config = options.datastore_config;
      this.node_config = options.node_config;
    }
  }

  get env_ref() {
    return `${this.parent_ref.split(':')[0]}.${this.key}`;
  }

  get ref() {
    return `${this.parent_ref}.${this.key}`;
  }

  get image() {
    return this.node_config.image;
  }

  get interfaces() {
    return { _default: { host: this.node_config.host, port: this.node_config.port || 8080 } };
  }
}
