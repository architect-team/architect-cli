import { DependencyNode, DependencyNodeOptions } from '.';
import { ServiceConfig, ServiceDatastore } from '../../service-config/base';

interface ExternalNodeOptions {
  parent_ref?: string;
  key: string;
  node_config: ServiceConfig | ServiceDatastore;
}

export class ExternalNode extends DependencyNode {
  __type = 'external';
  parent_ref?: string;
  key!: string;
  node_config!: ServiceConfig | ServiceDatastore;

  constructor(options: DependencyNodeOptions & ExternalNodeOptions) {
    super();
    if (options) {
      this.parent_ref = options.parent_ref;
      this.key = options.key;
      this.node_config = options.node_config;
    }
  }

  get env_ref() {
    return this.parent_ref ? `${this.parent_ref.split(':')[0]}.${this.key}` : this.key.split(':')[0];
  }

  get ref() {
    return this.parent_ref ? `${this.parent_ref}.${this.key}` : this.key;
  }

  get parameters(): { [key: string]: any } {
    if (!this._parameters) {
      this._parameters = {};
      for (const [key, value] of Object.entries(this.node_config instanceof ServiceConfig ? this.node_config.getParameters() : this.node_config.parameters)) {
        if ('default' in value && value.default !== undefined) {
          this._parameters[key] = value.default;
        }
      }
    }
    return this._parameters;
  }

  get interfaces(): { [key: string]: any } {
    return this.node_config instanceof ServiceConfig ?
      this.node_config.getInterfaces() :
      { _default: { host: this.node_config.host, port: this.node_config.port || 8080 } }; // TODO: datastore interfaces?
  }
}
