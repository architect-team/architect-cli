import { deserialize, serialize } from 'class-transformer';
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
import { DatastoreParameter, DependencyParameter, ServiceConfig, ServiceDatastore, ValueFromParameter, VaultParameter } from './service-config/base';
import { ServiceConfigV1 } from './service-config/v1';
import { EnvironmentInterpolationContext, InterfaceContext } from './utils/interpolation/interpolation-context';
import { ParameterInterpolator } from './utils/interpolation/parameter-interpolator';
import VaultManager from './vault-manager';

export default abstract class DependencyManager {
  abstract graph: DependencyGraph;
  debug = false;
  gateway_port!: number;
  _environment!: EnvironmentConfig;
  protected vault_manager!: VaultManager;
  protected _service_config_cache: { [key: string]: ServiceConfig | undefined };

  protected constructor() {
    this._service_config_cache = {};
  }

  async init(environment_config?: EnvironmentConfig): Promise<void> {
    this._environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.vault_manager = new VaultManager(this._environment.getVaults());
    this.gateway_port = await this.getServicePort(80);
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
    const env_service = this._environment.getServiceDetails(service_config.getRef());
    if (env_service) {
      node_config = node_config.merge(env_service);
    }

    // If debug is enabled merge in debug options ex. debug.command -> command
    const debug_options = node_config.getDebugOptions();
    if (this.debug && debug_options) {
      node_config = node_config.merge(debug_options);
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

  protected scopeEnv(node: DependencyNode, key: string) {
    const prefix = node.normalized_ref.replace(/[.-]/g, '_');
    return `${prefix}__arc__${key}`;
  }

  protected abstract toExternalProtocol(node: DependencyNode, interface_key: string): string;
  protected abstract toExternalHost(node: DependencyNode, interface_key: string): string;
  protected abstract toInternalHost(node: DependencyNode): string;
  protected toInternalPort(node: DependencyNode, interface_name: string): string {
    return node.interfaces[interface_name].port.toString();
  }

  /*
   * Expand all valueFrom parameters into real values that can be used inside of services and datastores
  */
  async loadParameters() {

    console.log('before', JSON.stringify(this.graph));

    //TODO:76:order these and add comments
    for (const node of this.graph.nodes) {
      for (const interface_name of Object.keys(node.interfaces)) {
        node.interfaces[interface_name] = this.mapToInterfaceContext(node, interface_name);
      }
    }

    this.interpolateAllNodeConfigs(this.graph);

    const all_interface_params = this.buildInterfaceEnvParams(this.graph);

    for (const node of this.graph.nodes) {
      for (const [key, value] of Object.entries(node.parameters)) {
        if (value instanceof Object && value.valueFrom && 'vault' in value.valueFrom) {
          node.parameters[key] = await this.vault_manager.getSecret(value as ValueFromParameter<VaultParameter>);
        }
      }
    }

    let all_env_params: { [key: string]: string } = {};
    for (const node of this.graph.nodes) {
      const env_params_to_expand: { [key: string]: string } = {};

      // TODO:76: we can kill this section once we remove support for valueFroms
      for (const [param_name, param_value] of Object.entries(node.parameters)) { // load the service's own params
        if (typeof param_value === 'string' || typeof param_value === 'boolean') {
          if (param_value.toString().indexOf('$') > -1 && param_value.toString().indexOf('${') === -1) {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.toString().replace(/\$/g, `$${this.scopeEnv(node, '')}`);
          } else {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.toString();
          }
        }
      }

      // TODO:76: we can kill this section once we remove support for valueFroms
      if (node instanceof ServiceNode) {
        const node_dependency_names = new Set([...Object.keys(node.node_config.getDependencies()), node.node_config.getName()]);

        for (const [param_name, param_value] of Object.entries(node.parameters)) { // load param references
          if (param_value instanceof Object && param_value.valueFrom && !('vault' in param_value.valueFrom)) {
            const value_from_param = param_value as ValueFromParameter<DependencyParameter>;
            let param_target_service_name = value_from_param.valueFrom.dependency || node.ref;
            // Support dep ref with or without tag
            if (param_target_service_name in node.node_config.getDependencies()) {
              const dep_config = node.node_config.getDependencies()[param_target_service_name];
              param_target_service_name = dep_config.getRef();
            }
            const param_target_datastore_name = (param_value as ValueFromParameter<DatastoreParameter>).valueFrom.datastore;

            if (param_target_service_name && !param_target_datastore_name) {
              let param_target_service;
              try {
                param_target_service = this.graph.getNodeByRef(param_target_service_name) as ServiceNode;
              } catch {
                param_target_service = this.graph.getNodeByRef(`${node.ref}.${param_target_service_name}`) as ServiceNode;
              }
              if (value_from_param.valueFrom.interface && !(value_from_param.valueFrom.interface in param_target_service.interfaces)) {
                throw new Error(`Interface ${value_from_param.valueFrom.interface} is not defined on service ${param_target_service_name}.`);
              }
              if (!param_target_service || !node_dependency_names.has(param_target_service.node_config.getName())) {
                throw new Error(`Service ${param_target_service_name} not found for config of ${node.ref}`);
              }

              if (value_from_param.valueFrom.interface && Object.keys(param_target_service.interfaces).length > 1) {
                env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(param_target_service, value_from_param.valueFrom.interface.toUpperCase())}_`);
              } else {
                if (!(this.scopeEnv(node, param_name) in env_params_to_expand)) { // prevent circular relationship
                  env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(param_target_service, '')}`);
                }
              }
            } else if (param_target_datastore_name) {
              const param_target_datastore = this.graph.getNodeByRef(`${node.ref}.${param_target_datastore_name}`);
              const datastore_names = Object.keys(node.node_config.getDatastores());
              if (!param_target_datastore || !datastore_names.includes(param_target_datastore_name)) {
                throw new Error(`Datastore ${param_target_datastore_name} not found for service ${node.ref}`);
              }
              env_params_to_expand[this.scopeEnv(node, param_name)] =
                param_value.valueFrom.value.replace(/\$/g, `$${this.scopeEnv(param_target_datastore, '')}`);
            } else {
              throw new Error(`Error creating parameter ${param_name} of ${node.ref}. A valueFrom reference must specify a dependency or datastore.`);
            }
          }
        }
      }
      all_env_params = { ...all_env_params, ...all_interface_params, ...env_params_to_expand };
    }

    //TODO:76: we can get rid of most of this block when we remove valueFrom
    // ignoreProcessEnv is important otherwise it will be stored globally
    const dotenv_config = { parsed: all_env_params, ignoreProcessEnv: true };
    const expanded_params = dotenvExpand(dotenv_config).parsed || {};
    for (const node of this.graph.nodes) {
      const prefix = this.scopeEnv(node, '');
      for (const [prefixed_key, value] of Object.entries(expanded_params)) {
        if (prefixed_key.startsWith(prefix)) {
          const key = prefixed_key.replace(prefix, '');

          // TODO:76: we can remove this when we get rid of valueFrom
          // if the node_config has this parameter already on it and it isn't a valueFrom, take that one, otherwise take the one from the dotenv_expansion (used for valueFroms)
          const params_from_node_config = (node as any)?.node_config?.parameters;
          if (params_from_node_config && params_from_node_config[key]?.default && !params_from_node_config[key].default?.valueFrom) {
            node.parameters[key] = (node as any).node_config.parameters[key].default;
          } else {
            node.parameters[key] = value;
          }

          // TODO:76: we can remove this when we get rid of valueFrom
          // we copy the new parameter value into the node_config if it doesn't already have it
          if (node instanceof ServiceNode) {
            (node.node_config as any).parameters = (node.node_config as any).parameters || {};
            (node.node_config as any).parameters[key] = (node.node_config as any).parameters[key] || {};
            (node.node_config as any).parameters[key].default = node.parameters[key];
          } else if (node instanceof DatastoreNode) {
            node.node_config.parameters = node.node_config.parameters || {};
            node.node_config.parameters[key] = node.node_config.parameters[key] || {};
            node.node_config.parameters[key].default = node.parameters[key];
          } else if (node instanceof ExternalNode && node.node_config instanceof ServiceConfig) {
            (node.node_config as any).parameters = (node.node_config as any).parameters || {};
            (node.node_config as any).parameters[key] = (node.node_config as any).parameters[key] || {};
            (node.node_config as any).parameters[key].default = node.parameters[key];
          } else if (node instanceof ExternalNode) {
            (node.node_config as ServiceDatastore).parameters = (node.node_config as ServiceDatastore).parameters || {};
            (node.node_config as ServiceDatastore).parameters[key] = (node.node_config as ServiceDatastore).parameters[key] || {};
            (node.node_config as ServiceDatastore).parameters[key].default = node.parameters[key];
          }
        }
      }
    }
    console.log('after', JSON.stringify(this.graph));
  }

  private interpolateAllNodeConfigs(graph: DependencyGraph): void {
    // map of dependency name (as it is in service config) to normalized_ref
    // used for lookups in expressions like this: ${ dependencies['friendly/name'].parameters... }
    const friendly_name_map = ParameterInterpolator.build_friendly_name_map(this.graph);

    let change_detected = true;
    let passes = 0;
    const MAX_DEPTH = 100; //TODO:76

    let environment_context = ParameterInterpolator.mapToDataContext(this.graph);

    // if there are any changes detected in the environment config in the course of interpolating every node, we need to do another pass
    while (change_detected && passes < MAX_DEPTH) {
      change_detected = false;
      for (const node of this.graph.getServiceNodes()) {

        const new_environment_context = this.interpolateNodeConfig(node, environment_context, friendly_name_map);

        if (serialize(environment_context) !== serialize(new_environment_context)) {
          change_detected = true;
        }
        environment_context = new_environment_context;
      }
      passes++;
    }

    if (passes >= MAX_DEPTH) {
      throw new Error('Stack Overflow Error'); //TODO:76: better message
    }
  }

  private interpolateNodeConfig(node: ServiceNode, environment_context: EnvironmentInterpolationContext, friendly_name_map: { [key: string]: { [key: string]: string } }): EnvironmentInterpolationContext {
    let change_detected = true;
    let passes = 0;
    const MAX_DEPTH = 100; //TODO:76

    const serial_config = serialize(node.node_config);
    let namespaced_serial_config = ParameterInterpolator.namespaceExpressions(node.namespace_ref, serial_config, friendly_name_map[node.ref]);

    while (change_detected && passes < MAX_DEPTH) {
      change_detected = false;

      const interpolated_serial_config = ParameterInterpolator.interpolateString(namespaced_serial_config, environment_context);
      // check to see if the interpolated value is different from the one listed in the environment_context. if it is, we're
      // going to want to do another pass and set update the environment_context, which requires a full deserialization
      if (interpolated_serial_config !== namespaced_serial_config) {
        change_detected = true;

        const deserialized_config = deserialize(ServiceConfigV1, interpolated_serial_config);
        node.node_config = deserialized_config;
        for (const node of this.graph.nodes) {
          for (const interface_name of Object.keys(node.interfaces)) {
            node.interfaces[interface_name] = this.mapToInterfaceContext(node, interface_name);
          }
        }
        environment_context[node.ref] = ParameterInterpolator.map(node);
        namespaced_serial_config = serialize(node.node_config);
      } else {
        node.node_config = deserialize(ServiceConfigV1, interpolated_serial_config);
        return environment_context;
      }
      passes++;
    }

    throw new Error('Stack Overflow Error'); //TODO:76: better message
  }

  private buildInterfaceEnvParams(graph: DependencyGraph): { [key: string]: string } {
    const interface_params: { [key: string]: string } = {};

    for (const node of graph.nodes) {
      if (node instanceof GatewayNode) {
        // gateway nodes have a default interface preset on them
        continue;
      } else if (node instanceof DatastoreNode || (node instanceof ExternalNode && !(node.node_config instanceof ServiceConfig))) {
        interface_params[this.scopeEnv(node, `EXTERNAL_HOST`)] = node.interfaces._default.host || '';

        interface_params[this.scopeEnv(node, `INTERNAL_HOST`)] = node.interfaces._default.host || '';
        interface_params[this.scopeEnv(node, `HOST`)] = node.interfaces._default.host || '';

        interface_params[this.scopeEnv(node, `EXTERNAL_PORT`)] = node.interfaces._default.port?.toString() || '';
        interface_params[this.scopeEnv(node, `INTERNAL_PORT`)] = node.interfaces._default.port?.toString() || '';
        interface_params[this.scopeEnv(node, `PORT`)] = node.interfaces._default.port?.toString() || '';

        interface_params[this.scopeEnv(node, `EXTERNAL_PROTOCOL`)] = '';
        interface_params[this.scopeEnv(node, `INTERNAL_PROTOCOL`)] = '';

        interface_params[this.scopeEnv(node, `EXTERNAL_URL`)] = '';
        interface_params[this.scopeEnv(node, `INTERNAL_URL`)] = '';
      } else {
        for (const interface_name of Object.keys(node.interfaces)) {
          const prefix = interface_name === '_default' || Object.keys(node.interfaces).length === 1 ? '' : `${interface_name}_`.toUpperCase();
          interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_HOST`)] = node.interfaces[interface_name].external.host;

          interface_params[this.scopeEnv(node, `${prefix}INTERNAL_HOST`)] = node.interfaces[interface_name].internal.host;
          interface_params[this.scopeEnv(node, `${prefix}HOST`)] = node.interfaces[interface_name].host;

          interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_PORT`)] = node.interfaces[interface_name].external.port;
          interface_params[this.scopeEnv(node, `${prefix}INTERNAL_PORT`)] = node.interfaces[interface_name].internal.port;
          interface_params[this.scopeEnv(node, `${prefix}PORT`)] = node.interfaces[interface_name].port;

          interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_PROTOCOL`)] = node.interfaces[interface_name].external.protocol;
          interface_params[this.scopeEnv(node, `${prefix}INTERNAL_PROTOCOL`)] = node.interfaces[interface_name].internal.protocol;

          interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_URL`)] = node.interfaces[interface_name].external.url;
          interface_params[this.scopeEnv(node, `${prefix}INTERNAL_URL`)] = node.interfaces[interface_name].internal.url;
        }
      }
    }
    return interface_params;
  }

  private mapToInterfaceContext(node: DependencyNode, interface_name: string): InterfaceContext {
    const gateway_node = this.graph.nodes.find((node) => (node instanceof GatewayNode));
    const gateway_port = gateway_node ? this.gateway_port : '';
    const interface_details = node.interfaces[interface_name];

    let external_host: string, internal_host: string, external_port: string, internal_port: string, external_protocol: string, internal_protocol: string;
    if (node instanceof ExternalNode) {
      if (!interface_details.host) {
        throw new Error('External node needs to override the host');
      }
      external_host = interface_details.host;
      internal_host = interface_details.host;
      external_port = interface_details.port.toString();
      internal_port = interface_details.port.toString();
      external_protocol = 'https';
      internal_protocol = 'https';
    } else {
      external_host = this.toExternalHost(node, interface_name);
      internal_host = this.toInternalHost(node);
      external_port = gateway_port.toString();
      internal_port = this.toInternalPort(node, interface_name);
      external_protocol = this.toExternalProtocol(node, interface_name);
      internal_protocol = 'http';
    }
    const subdomain = interface_details.subdomain;

    const internal_url = internal_protocol + '://' + internal_host + ':' + internal_port;
    const external_url = external_host ? (external_protocol + '://' + external_host + ':' + external_port) : '';

    return {
      host: internal_host,
      port: internal_port,
      protocol: internal_protocol,
      url: internal_url,
      subdomain: subdomain,
      external: {
        host: external_host,
        port: external_port,
        url: external_url,
        protocol: external_protocol,
        subdomain: subdomain,
      },
      internal: {
        host: internal_host,
        port: internal_port,
        url: internal_url,
        protocol: internal_protocol,
        subdomain: subdomain,
      }
    };
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

    for (const dep_config of Object.values(parent_node.node_config.getDependencies())) {
      if (dep_config.getPrivate()) {
        dep_config.setParentRef(parent_node.ref);
      }
      const dep_node = await this.loadServiceFromConfig(dep_config, recursive);
      this.graph.addNode(dep_node);
      const edge = new ServiceEdge(parent_node.ref, dep_node.ref);
      this.graph.addEdge(edge);
    }
  }

  abstract async loadServiceConfig(initial_config: ServiceConfig): Promise<ServiceConfig>;

  protected async loadServiceConfigWrapper(initial_config: ServiceConfig): Promise<ServiceConfig> {
    let service_extends = initial_config.getExtends();
    if (!service_extends) {
      return this.loadServiceConfig(initial_config);
    }

    const seen_extends = new Set();
    let service_config;
    while (service_extends) {
      if (seen_extends.has(service_extends)) {
        throw new Error(`Circular service extends detected: ${service_extends}`);
      }
      seen_extends.add(service_extends);
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      let cached_config = this._service_config_cache[service_extends];
      if (!cached_config) {
        cached_config = await this.loadServiceConfig(service_config || initial_config);
        this._service_config_cache[service_extends] = cached_config;
      }
      service_extends = cached_config.getExtends();
      service_config = service_config ? cached_config.merge(service_config) : cached_config;
    }
    return service_config;
  }

  async loadServiceFromConfig(config: ServiceConfig, recursive = true): Promise<ServiceNode | ExternalNode> {
    const env_service = this._environment.getServiceDetails(config.getRef());
    if (env_service) {
      config = config.merge(env_service);
    }

    const service_ref = config.getRef();
    const existing_node = this.graph.nodes_map.get(service_ref);
    if (existing_node) {
      return existing_node as ServiceNode | ExternalNode;
    }
    if (Object.keys(config.getInterfaces()).length > 0 && Object.values(config?.getInterfaces()).every((i) => (i.host))) {
      return this.loadExternalService(config, service_ref);
    }

    const service_node = await this.loadServiceNode(config);
    this.graph.addNode(service_node);
    await this.loadDatastores(service_node);
    if (recursive) {
      await this.loadDependencies(service_node, recursive);
    }
    return service_node;
  }

  async loadServiceNode(initial_config: ServiceConfig): Promise<ServiceNode> {
    // Load the service config without merging in environment overrides
    const service_config = await this.loadServiceConfigWrapper(initial_config);
    // Allow for inline overrides of services in dependencies/env
    const node_config = this.getNodeConfig(service_config.merge(initial_config));
    return new ServiceNode({
      service_config: service_config,
      node_config: node_config,
      tag: node_config.getRef().split(':')[node_config.getRef().split(':').length - 1],
      image: node_config.getImage(),
      digest: node_config.getDigest(),
    });
  }

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
    }

    const node = new ExternalNode({
      key: service_ref,
      node_config: env_service_config,
    });
    this.graph.addNode(node);
    return node;
  }
}
