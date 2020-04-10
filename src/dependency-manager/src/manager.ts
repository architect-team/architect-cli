import dotenvExpand from 'dotenv-expand';
import { ServiceNode } from '.';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import { EnvironmentService } from './environment-service/base';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import NotificationEdge from './graph/edge/notification';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import { DatastoreNode } from './graph/node/datastore';
import { ExternalNode } from './graph/node/external';
import GatewayNode from './graph/node/gateway';
import { ServiceConfig, ServiceParameter } from './service-config/base';
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

export default abstract class DependencyManager {
  abstract graph: DependencyGraph;
  environment: EnvironmentConfig;
  protected vault_manager: VaultManager;

  constructor(environment_config?: EnvironmentConfig) {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.vault_manager = new VaultManager(this.environment.getVaults());
  }

  /**
   * Loop through the nodes and enrich the graph with edges between notifiers and subscribers
   */
  protected loadSubscriptions() {
    for (const node of this.graph.nodes) {
      if (node instanceof ServiceNode) {
        for (const svc_name of Object.keys(node.service_config.getSubscriptions())) {
          const ref = Array.from(this.graph.nodes_map.keys()).find(key => key.startsWith(svc_name));

          if (ref && this.graph.nodes_map.has(ref)) {
            const edge = new NotificationEdge(ref, node.ref);
            this.graph.addEdge(edge);
          }
        }
      }
    }
  }

  private scopeEnv(node: DependencyNode, key: string, node_prefix = '') {
    return `${node_prefix ? `${node_prefix}_` : ''}${node.normalized_ref}_${key}`.toUpperCase().replace(/[.-]/g, '_');
  }

  /*
   * Expand all valueFrom parameters into real values that can be used inside of services and datastores
  */
  protected loadParameters() {
    const env_params_to_expand: { [key: string]: string } = {};

    const subdomain_map: { [key: string]: string } = {};
    for (const edge of this.graph.edges.filter((edge) => (edge instanceof IngressEdge))) {
      subdomain_map[edge.to] = (edge as IngressEdge).subdomain;
    }

    const gateway_node = this.graph.nodes.find((node) => (node instanceof GatewayNode));
    const gateway_port = gateway_node ? gateway_node.ports[0].expose.toString() : '';
    for (const node of this.graph.nodes) {
      let interfaces: { [key: string]: { host?: string; port: number } } = {};
      if (node instanceof ServiceNode) {
        interfaces = node.interfaces;
      } else if (node instanceof ExternalNode) {
        interfaces = node.interfaces || { _default: { host: node.host, port: node.ports[0].target } };
      } else {
        interfaces = { _default: { port: node.ports[0].target } };
      }

      for (const [interface_name, interface_details] of Object.entries(interfaces)) {
        let external_host, internal_host, external_port, internal_port;
        if (node instanceof ExternalNode) {
          if (!interface_details.host) {
            throw new Error('External node needs to override the host');
          }
          external_host = interface_details.host;
          internal_host = interface_details.host;
          external_port = interface_details.port.toString();
          internal_port = interface_details.port.toString();
        } else {
          external_host = (subdomain_map[node.ref] ? `${subdomain_map[node.ref]}.localhost` : '');
          internal_host = node.normalized_ref;
          external_port = gateway_port;
          internal_port = interface_details.port.toString();
        }

        const prefix = interface_name === '_default' ? '' : `${interface_name}_`;
        env_params_to_expand[this.scopeEnv(node, `${prefix}EXTERNAL_HOST`)] = external_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}INTERNAL_HOST`)] = internal_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}HOST`)] = external_host ? external_host : internal_host;
        env_params_to_expand[this.scopeEnv(node, `${prefix}EXTERNAL_PORT`)] = external_port;
        env_params_to_expand[this.scopeEnv(node, `${prefix}INTERNAL_PORT`)] = internal_port;
        env_params_to_expand[this.scopeEnv(node, `${prefix}PORT`)] = external_port ? external_port : internal_port;
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
          if (param_value instanceof Object && param_value.valueFrom) {
            const value_from_param = param_value as ValueFromParameter;
            let param_target_service_name = value_from_param.valueFrom.dependency;
            // Support dep ref with or without tag
            if (param_target_service_name in node.service_config.getDependencies()) {
              param_target_service_name = `${param_target_service_name}:${node.service_config.getDependencies()[param_target_service_name]}`;
            }
            const param_target_datastore_name = (param_value as DatastoreValueFromParameter).valueFrom.datastore;

            if (param_target_service_name) {
              const param_target_service = this.graph.getNodeByRef(param_target_service_name);
              if (value_from_param.valueFrom.interface && !(value_from_param.valueFrom.interface in (param_target_service as ServiceNode).interfaces)) {
                throw new Error(`Interface ${value_from_param.valueFrom.interface} is not defined on service ${param_target_service_name}.`);
              }
              const node_dependency_refs = node.service_config.getDependencies();
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
              const datastore_names = Object.keys(node.service_config.getDatastores());
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
   * Parse the parameter values by comparing defaults for a service to
   * values in the environment configuration.
   */
  protected async getParamValues(
    service_ref: string,
    parameters: { [key: string]: ServiceParameter },
    datastore_key?: string,
  ): Promise<{ [key: string]: string | number | ValueFromParameter | DatastoreValueFromParameter }> {
    const services = this.environment.getServices();
    const global_params = this.environment.getParameters();
    let raw_params: { [key: string]: string | number | ValueFromParameter | VaultParameter } = {};
    if (datastore_key && services[service_ref] && services[service_ref].getDatastores()[datastore_key]) {
      raw_params = {
        ...global_params,
        ...services[service_ref].getDatastores()[datastore_key].parameters,
      } || {};
    } else if (services[service_ref]) {
      raw_params = {
        ...global_params,
        ...services[service_ref].getParameters(),
      } || {};
    }

    // Enrich vault parameters
    const env_params = new Map<string, string | number | ValueFromParameter>();
    for (const [key, data] of Object.entries(raw_params)) {
      if (data instanceof Object && data.valueFrom && 'vault' in data.valueFrom) {
        env_params.set(key, await this.vault_manager.getSecret(data as VaultParameter));
      } else {
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        env_params.set(key, data);
      }
    }

    return Object.keys(parameters).reduce(
      (params: { [s: string]: string | number | ValueFromParameter | DatastoreValueFromParameter }, key: string) => {
        const service_param = parameters[key];

        let val = env_params.has(key) ? env_params.get(key) : service_param.default;

        // note: an empty string is considered a valid value for a parameter so we explicitly check for null or undefined here
        if (val === null || val === undefined) {
          return params;
        }

        if (typeof val === 'number') {
          val = val.toString();
        }
        params[key] = val;
        return params;
      }, {});
  }

  /**
   * Returns a port available for a service to run on. Primary use-case is to be
   * extended by the CLI to return a dynamic available port.
   */
  protected async getServicePort(): Promise<number> {
    return Promise.resolve(80);
  }

  /**
   * Similar to `loadDependencies()`, but iterates over the datastores instead
   */
  protected async loadDatastores(parent_node: ServiceNode) {
    if (parent_node instanceof ExternalNode) { return; }

    for (const [ds_name, ds_config] of Object.entries(parent_node.service_config.getDatastores())) {
      const dep_node_config = {
        parent_ref: parent_node.ref,
        key: ds_name,
        parameters: await this.getParamValues(
          parent_node.ref,
          ds_config.parameters,
          ds_name,
        ),
      };
      const environment_service_config = this.environment.getServices()[parent_node.ref];
      let dep_node;

      const database_host = environment_service_config?.getDatastores()[ds_name]?.host;
      if (database_host) {
        const external_port = environment_service_config?.getDatastores()[ds_name]?.port || ds_config.docker.target_port;
        dep_node = new ExternalNode({
          ...dep_node_config,
          host: database_host,
          ports: [{
            target: external_port,
            expose: external_port,
          }],
        });
      } else {
        dep_node = new DatastoreNode({
          ...dep_node_config,
          image: ds_config.docker.image,
          ports: [{
            target: ds_config.docker.target_port,
            expose: await this.getServicePort(),
          }],
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

    for (const [dep_name, dep_id] of Object.entries(parent_node.service_config.getDependencies())) {
      const dep_node = await this.loadService(dep_name, dep_id, recursive);
      this.graph.addNode(dep_node);
      const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
      this.graph.addEdge(edge);
    }
  }

  /**
   * Queries the API to create a node and config object for a service based on
   * its name and tag
   */
  abstract async loadService(service_name: string, service_tag: string, recursive: boolean): Promise<ServiceNode | ExternalNode>;

  /**
   * Create an external node and add it to the graph
   */
  async loadExternalService(env_service_config: EnvironmentService, service_ref: string) {
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
      host: interfaces._default?.host,
      ports: Object.values(interfaces).map((i) => ({ target: i.port, expose: i.port })),
      parameters: env_service_config.getParameters(),
      key: service_ref,
      interfaces: interfaces,
    });
    this.graph.addNode(node);
    return node;
  }

  abstract async loadServiceConfig(node_ref: string): Promise<ServiceConfig>;
}
