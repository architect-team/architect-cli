import dotenvExpand from 'dotenv-expand';
import { ServiceConfigBuilder, ServiceNode } from '.';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import NotificationEdge from './graph/edge/notification';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import { DatastoreNode } from './graph/node/datastore';
import { ExternalNode } from './graph/node/external';
import GatewayNode from './graph/node/gateway';
import { ServiceConfig } from './service-config/base';
import VaultManager from './vault-manager';

export interface VaultParameter {
  valueFrom: {
    vault: string;
    key: string;
  };
}

export interface ValueFromParameter {
  valueFrom: {
    dependency: string;
    value: string;
    interface?: string;
  };
}

export interface DatastoreValueFromParameter {
  valueFrom: {
    datastore: string;
    value: string;
  };
}

export type Parameter = string | number | ValueFromParameter | VaultParameter | DatastoreValueFromParameter;

export default abstract class DependencyManager {
  abstract graph: DependencyGraph;
  debug = false;
  gateway_port: Promise<number>;
  _environment: EnvironmentConfig;
  protected vault_manager: VaultManager;

  constructor(environment_config?: EnvironmentConfig) {
    this._environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.vault_manager = new VaultManager(this._environment.getVaults());
    this.gateway_port = this.getServicePort(80);
  }

  getNodeConfig(service_config: ServiceConfig) {
    // Merge in global parameters
    const global_overrides: any = {
      parameters: {},
      datastores: {},
    };
    const global_parameters = this._environment.getParameters();
    for (const key of Object.keys(service_config.getParameters())) {
      if (key in global_parameters) {
        global_overrides.parameters[key] = global_parameters[key];
      }
    }
    for (const [datastore_name, datastore] of Object.entries(service_config.getDatastores())) {
      for (const key of Object.keys(datastore.parameters)) {
        if (key in global_parameters) {
          if (!global_overrides.datastores[datastore_name]) {
            global_overrides.datastores[datastore_name] = { parameters: {} };
          }
          global_overrides.datastores[datastore_name].parameters[key] = global_parameters[key];
        }
      }
    }
    let node_config = service_config.merge(ServiceConfigBuilder.buildFromJSON({ __version: service_config.__version, ...global_overrides }));

    // Merge in service overrides in the environment
    const env_service = this._environment.getServiceDetails(`${service_config.getName()}:latest`);
    if (env_service) {
      node_config = node_config.merge(env_service);
    }

    // If debug is enabled merge in debug options ex. debug.command -> command
    const debug_options = node_config.getDebugOptions();
    if (this.debug && debug_options) {
      node_config = node_config.merge(ServiceConfigBuilder.buildFromJSON({ __version: node_config.__version, ...debug_options }));
    }
    return node_config;
  }

  /**
   * Loop through the nodes and enrich the graph with edges between notifiers and subscribers
   */
  protected loadSubscriptions() {
    for (const node of this.graph.nodes) {
      if (node instanceof ServiceNode) {
        for (const svc_name of Object.keys(node.node_config.getSubscriptions())) {
          const ref = Array.from(this.graph.nodes_map.keys()).find(key => key.startsWith(svc_name));

          if (ref && this.graph.nodes_map.has(ref)) {
            const edge = new NotificationEdge(ref, node.ref);
            this.graph.addEdge(edge);
          }
        }
      }
    }
  }

  protected scopeEnv(node: DependencyNode, key: string, node_prefix = '') {
    return `${node_prefix ? `${node_prefix}_` : ''}${node.normalized_ref}_${key}`.toUpperCase().replace(/[.-]/g, '_');
  }

  protected abstract toExternalHost(node: DependencyNode): string;
  protected abstract toInternalHost(node: DependencyNode): string;

  /*
   * Expand all valueFrom parameters into real values that can be used inside of services and datastores
  */
  protected async loadParameters() {
    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        if (value instanceof Object && value.valueFrom && 'vault' in value.valueFrom) {
          node.parameters[key] = await this.vault_manager.getSecret(value as VaultParameter);
        }
      }
    }

    const env_params_to_expand: { [key: string]: string } = {};
    const gateway_node = this.graph.nodes.find((node) => (node instanceof GatewayNode));
    const gateway_port = gateway_node ? await this.gateway_port : '';
    for (const node of this.graph.nodes) {
      for (const [interface_name, interface_details] of Object.entries(node.interfaces)) {
        let external_host: string, internal_host: string, external_port: string, internal_port: string;
        if (node instanceof ExternalNode) {
          if (!interface_details.host) {
            throw new Error('External node needs to override the host');
          }
          external_host = interface_details.host;
          internal_host = interface_details.host;
          external_port = interface_details.port.toString();
          internal_port = interface_details.port.toString();
        } else {
          external_host = this.toExternalHost(node);
          internal_host = this.toInternalHost(node);
          external_port = gateway_port.toString();
          internal_port = interface_details.port.toString();
        }

        const prefix = interface_name === '_default' ? '' : `${interface_name}_`;
        env_params_to_expand[this.scopeEnv(node, `${prefix}EXTERNAL_HOST`)] = external_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}INTERNAL_HOST`)] = internal_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}HOST`)] = external_host ? external_host : internal_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}EXTERNAL_PORT`)] = external_port;
        env_params_to_expand[this.scopeEnv(node, `${prefix}INTERNAL_PORT`)] = internal_port;
        env_params_to_expand[this.scopeEnv(node, `${prefix}PORT`)] = external_host ? external_port : internal_port;
      }

      for (const [param_name, param_value] of Object.entries(node.parameters)) { // load the service's own params
        if (typeof param_value === 'string' || typeof param_value === 'boolean') {
          if (param_value.toString().indexOf('$') > -1) {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.replace(/\$/g, `$${this.scopeEnv(node, '')}`);
          } else {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.toString();
          }
        }
      }

      if (node instanceof ServiceNode) {
        for (const [param_name, param_value] of Object.entries(node.parameters)) { // load param references
          if (param_value instanceof Object && param_value.valueFrom && !('vault' in param_value.valueFrom)) {
            const value_from_param = param_value as ValueFromParameter;
            let param_target_service_name = value_from_param.valueFrom.dependency;
            // Support dep ref with or without tag
            if (param_target_service_name in node.node_config.getDependencies()) {
              param_target_service_name = `${param_target_service_name}:${node.node_config.getDependencies()[param_target_service_name]}`;
            }
            const param_target_datastore_name = (param_value as DatastoreValueFromParameter).valueFrom.datastore;

            if (param_target_service_name) {
              const param_target_service = this.graph.getNodeByRef(param_target_service_name);
              if (value_from_param.valueFrom.interface && !(value_from_param.valueFrom.interface in (param_target_service as ServiceNode).interfaces)) {
                throw new Error(`Interface ${value_from_param.valueFrom.interface} is not defined on service ${param_target_service_name}.`);
              }
              const node_dependency_refs = node.node_config.getDependencies();
              if (!param_target_service || !node_dependency_refs[param_target_service.env_ref]) {
                throw new Error(`Service ${param_target_service_name} not found for config of ${node.env_ref}`);
              }

              if (value_from_param.valueFrom.interface) {
                env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(param_target_service, value_from_param.valueFrom.interface)}_`);
              } else {
                env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(param_target_service, '')}`);
              }
            } else if (param_target_datastore_name) {
              const param_target_datastore = this.graph.getNodeByRef(`${node.ref}.${param_target_datastore_name}`);
              const datastore_names = Object.keys(node.node_config.getDatastores());
              if (!param_target_datastore || !datastore_names.includes(param_target_datastore_name)) {
                throw new Error(`Datastore ${param_target_datastore_name} not found for service ${node.env_ref}`);
              }
              env_params_to_expand[this.scopeEnv(node, param_name, param_target_datastore_name)] =
                param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(node, param_target_datastore_name)}_`);
            } else {
              throw new Error(`Error creating parameter ${param_name} of ${node.ref}. A valueFrom reference must specify a dependency or datastore.`);
            }
          }
        }
      }
    }

    // ignoreProcessEnv is important otherwise it will be stored globally
    const dotenv_config = { parsed: env_params_to_expand, ignoreProcessEnv: true };
    const expanded_params = dotenvExpand(dotenv_config).parsed;
    for (const node of this.graph.nodes) {
      if (node instanceof ServiceNode) {
        const service_name = node.normalized_ref;
        const service_prefix = service_name.replace(/[^\w\s]/gi, '_').toUpperCase();
        const written_env_keys = [];

        // map datastore params
        const node_datastores = this.graph.getNodeDependencies(node).filter(node => node instanceof DatastoreNode || node instanceof ExternalNode);
        for (const datastore of node_datastores) {
          const datastore_prefix = `${(datastore as DatastoreNode).key}_${service_prefix}`.toUpperCase();
          const service_datastore_params = Object.entries(expanded_params || {})
            .filter(([key, _]) => key.startsWith(datastore_prefix));
          // reverse order params by length in order to avoid key collisions
          service_datastore_params.sort((pair1: [string, string], pair2: [string, string]) => {
            return pair2[0].length - pair1[0].length;
          });

          for (const [param_name, param_value] of service_datastore_params) {
            const real_param_name = param_name.replace(`${datastore_prefix}_`, '');
            node.parameters[real_param_name] = param_value;
            written_env_keys.push(param_name.replace(`${datastore_prefix}_`, ''));
          }
        }

        // map service params
        const service_params = Object.entries(expanded_params || {})
          .filter(([key, _]) => key.startsWith(service_prefix));

        // reverse order params by length in order to avoid key collisions
        service_params.sort((pair1: [string, string], pair2: [string, string]) => {
          return pair2[0].length - pair1[0].length;
        });

        for (const [param_name, param_value] of service_params) {
          const real_param_name = param_name.replace(`${service_prefix}_`, '');
          if (!written_env_keys.find(key => key === real_param_name)) {
            node.parameters[real_param_name] = param_value;
          }
        }
      }
    }
  }

  /**
   * Returns a port available for a service to run on. Primary use-case is to be
   * extended by the CLI to return a dynamic available port.
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return Promise.resolve(starting_port || 80);
  }

  /**
   * Similar to `loadDependencies()`, but iterates over the datastores instead
   */
  protected async loadDatastores(parent_node: ServiceNode) {
    if (parent_node instanceof ExternalNode) { return; }

    for (const [ds_name, ds_config] of Object.entries(parent_node.node_config.getDatastores())) {
      let dep_node;

      if (ds_config.host) {
        dep_node = new ExternalNode({
          parent_ref: parent_node.ref,
          key: ds_name,
          node_config: ds_config,
        });
      } else {
        dep_node = new DatastoreNode({
          parent_ref: parent_node.ref,
          key: ds_name,
          datastore_config: parent_node.service_config.getDatastores()[ds_name] || ds_config,
          node_config: ds_config,
        });
      }

      this.graph.addNode(dep_node);
      const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
      this.graph.addEdge(edge);
    }
  }

  /**
   * Load the dependency graph with nodes and edges associated with a services
   * dependencies and datastores
   */
  async loadDependencies(parent_node: ServiceNode, recursive = true) {
    if (parent_node instanceof ExternalNode) { return; }

    for (const [dep_name, dep_id] of Object.entries(parent_node.node_config.getDependencies())) {
      const dep_node = await this.loadService(`${dep_name}:${dep_id}`, recursive);
      this.graph.addNode(dep_node);
      const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
      this.graph.addEdge(edge);
    }
  }

  /**
   * Queries the API to create a node and config object for a service based on
   * its name and tag
   */
  abstract async loadService(service_ref: string, recursive: boolean): Promise<ServiceNode | ExternalNode>;

  /**
   * Create an external node and add it to the graph
   */
  async loadExternalService(env_service_config: ServiceConfig, service_ref: string) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const interfaces = env_service_config.getInterfaces()!;
    if (interfaces) {
      for (const [name, interface_details] of Object.entries(interfaces)) {
        if (!interface_details.host || !interface_details.port) {
          throw new Error(`As an interface specified in the environment config, interface ${name} requires that both a host and port be declared.`);
        }
      }

      try {
        const env_config_interfaces = Object.keys(interfaces);
        const expected_interfaces = Object.keys((await this.loadServiceConfig(service_ref)).getInterfaces());
        const union = new Set([...expected_interfaces, ...env_config_interfaces]);
        if (union.size !== expected_interfaces.length || env_config_interfaces.length !== expected_interfaces.length) {
          throw new Error(`All or no service interfaces for service ${service_ref} should be overridden in the environment config.`);
        }
      } catch (err) {
        console.log(`Warning: Failed to find config for external service ${service_ref}`);
      }
    }

    const node = new ExternalNode({
      key: service_ref,
      node_config: env_service_config,
    });
    this.graph.addNode(node);
    return node;
  }

  abstract async loadServiceConfig(node_ref: string): Promise<ServiceConfig>;
}
