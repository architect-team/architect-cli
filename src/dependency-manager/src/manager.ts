import dotenvExpand from 'dotenv-expand';
import Mustache from 'mustache';
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
import { InterpolationContext } from './interpolation/interpolation-context';
import { DatastoreParameter, DependencyParameter, ParameterValue, ParameterValueV2, ServiceConfig, ValueFromParameter, VaultParameter } from './service-config/base';
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
    const global_parameter_map: { [key: string]: any } = {};
    const environment_context = this.mapToDataContext(this.graph);
    const all_parameters = this.mapToParameterSet(this.graph, global_parameter_map);
    const interpolated_parameters = this.interpolateAllParameters(all_parameters, environment_context);
    console.log('environment_context: ', JSON.stringify(environment_context));
    console.log('all_parameters: ', JSON.stringify(all_parameters));
    console.log('interpolated_parameters: ', JSON.stringify(interpolated_parameters));

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
      const interface_env_params = this.buildInterfaceEnvParams(node);

      for (const [param_name, param_value] of Object.entries(node.parameters)) { // load the service's own params
        if (typeof param_value === 'string' || typeof param_value === 'boolean') {
          if (param_value.toString().indexOf('$') > -1 && param_value.toString().indexOf('${') === -1) {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.toString().replace(/\$/g, `$${this.scopeEnv(node, '')}`);
          } else {
            env_params_to_expand[this.scopeEnv(node, param_name)] = param_value.toString();
          }
        }
      }

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
      all_env_params = { ...all_env_params, ...interface_env_params, ...env_params_to_expand };
    }

    // ignoreProcessEnv is important otherwise it will be stored globally
    const dotenv_config = { parsed: all_env_params, ignoreProcessEnv: true };
    const expanded_params = dotenvExpand(dotenv_config).parsed || {};
    for (const node of this.graph.nodes) {
      const prefix = this.scopeEnv(node, '');
      for (const [prefixed_key, value] of Object.entries(expanded_params)) {
        if (prefixed_key.startsWith(prefix)) {
          const key = prefixed_key.replace(prefix, '');
          node.parameters[key] = value;

          if (interpolated_parameters[node.namespace_ref][key]) {
            if (value != interpolated_parameters[node.namespace_ref][key]) {
              console.log(`new value for param: ${value}`);
            }
            node.parameters[key] = interpolated_parameters[node.namespace_ref][key] as ParameterValue;
          }
        }
      }
    }
  }

  private interpolateAllParameters(all_parameters: { [key: string]: { [key: string]: ParameterValueV2 } }, environment_context: { [key: string]: InterpolationContext }): { [key: string]: { [key: string]: ParameterValueV2 } } { //TODO:76:type environment_context

    // this illustrates the drawback with not using the structure of the graph to traverse this more efficiently
    let change_detected = true;
    let passes = 0;
    const MAX_DEPTH = 100; //TODO:76
    const interpolated_parameters: { [key: string]: { [key: string]: ParameterValueV2 } } = {};
    while (change_detected && passes < MAX_DEPTH) {

      change_detected = false;
      for (const [node_ref, parameters] of Object.entries(all_parameters)) {

        interpolated_parameters[node_ref] = {};
        for (const [param_key, param_value] of Object.entries(parameters)) {
          const interpolated_value = this.interpolateParamValue(param_value, environment_context);

          // check to see if the interpolated value is different from the one listed in the environment_context. if it is, we're
          // going to want to do another pass and set the updated value in the environment_context
          if (environment_context[node_ref].parameters[param_key] !== interpolated_value) {
            change_detected = true;
            environment_context[node_ref].parameters[param_key] = interpolated_value;
          }
          interpolated_parameters[node_ref][param_key] = interpolated_value;
        }
      }
      passes++;
    }

    if (passes >= MAX_DEPTH) {
      throw new Error('Stack Overflow Error'); //TODO:76: specify error
    }
    console.log(`interpolated in ${passes} passes`);

    return interpolated_parameters;
  }

  private build_friendly_name_map(): { [key: string]: { [key: string]: string } } {
    const friendly_name_map: { [key: string]: { [key: string]: string } } = {};
    for (const node of this.graph.nodes) {
      friendly_name_map[node.ref] = {};
      if (!(node instanceof ServiceNode)) {
        continue;
      }
      for (const friendly_name of Object.keys(node.node_config.getDependencies())) {
        const top_level_node = this.graph.nodes
          .filter(n => (n instanceof ServiceNode))
          .map(n => n as ServiceNode)
          .find(n => n.node_config.getName() === friendly_name);

        if (top_level_node) {
          friendly_name_map[node.ref][friendly_name] = top_level_node.namespace_ref;
        }
      }
    }
    return friendly_name_map;
  }

  private mapToParameterSet(graph: DependencyGraph, global_parameter_map: { [key: string]: string }): { [key: string]: { [key: string]: ParameterValueV2 } } {

    const friendly_name_map = this.build_friendly_name_map();
    console.log('friendly_name_map', friendly_name_map)
    const parameter_set: { [key: string]: { [key: string]: ParameterValueV2 } } = {};
    for (const node of graph.nodes) {
      console.log('working on ' + node.namespace_ref);
      if (!(node instanceof ServiceNode)) {
        console.log('Node is not a ServiceNode, skipping');
        parameter_set[node.namespace_ref] = {};
        continue;
      }
      parameter_set[node.namespace_ref] = {};
      for (const [param_key, param_details] of Object.entries(node.node_config.getParameters())) {
        console.log('working on ' + param_key);
        if (typeof param_details.default === 'object' && param_details.default !== null) {
          console.log('this is a valueFrom param, skipping...');
          continue; //TODO:76: this can get ripped out when we remove ValueFrom support
        }

        const global_value = global_parameter_map[param_key];
        const upstream_value = null; // this.namespaceParameter(upstream_node.namespace_ref, upstream_node.dependencies[node.ref].parameters[param_key]); namespace it to the node that declared it!
        const param_default = this.namespaceParameter(node.namespace_ref, (param_details.default as ParameterValueV2), friendly_name_map[node.ref]);
        const param_value = this.mergeParam(upstream_value, global_value, param_default);

        if (this.isNullParamValue(param_value) && param_details.required) {
          throw new Error(`Required parameter doesn't have a value`);
        }

        parameter_set[node.namespace_ref][param_key] = param_value;
      }
    }

    return parameter_set;
  }

  private mapToDataContext(graph: DependencyGraph): { [key: string]: InterpolationContext } {

    const environment_context: { [key: string]: any } = {};

    for (const node of graph.nodes) {
      if (!(node instanceof ServiceNode)) {
        continue;
      }

      const service_context = this.map(node.service_config);
      environment_context[node.namespace_ref] = service_context;
    }

    return environment_context;
  }

  private map(node: ServiceConfig): InterpolationContext {
    return {
      parameters: Object.entries(node.getParameters()).reduce((result: { [key: string]: any }, [k, v]) => {
        result[k] = v.default;
        return result;
      }, {}),
      interfaces: Object.entries(node.getInterfaces()).reduce((result: { [key: string]: any }, [k, v]) => {
        result[k] = v;
        return result;
      }, {}),
    };
  }

  private mergeParam(parent_value: ParameterValueV2, global_value: ParameterValueV2, default_value: ParameterValueV2) {
    return !this.isNullParamValue(parent_value) ? parent_value
      : !this.isNullParamValue(global_value) ? global_value
        : !this.isNullParamValue(default_value) ? default_value
          : null;
  }

  private isNullParamValue(param_value: ParameterValueV2) {
    return param_value === null || param_value === undefined;
  }

  private namespaceParameter(node_ref: string, param_value: ParameterValueV2, friendly_name_map: { [key: string]: string }) {
    if (typeof param_value !== 'string') {
      return param_value;
    }
    if (!param_value.includes('${')) {
      return param_value;
    }

    let namespaced_value = param_value;

    const interfaces_search_string = /\$\{\s*interfaces/g;
    namespaced_value = namespaced_value.replace(interfaces_search_string, `$\{ ${node_ref}.interfaces`);

    const parameters_search_string = /\$\{\s*parameters/g;
    namespaced_value = namespaced_value.replace(parameters_search_string, `$\{ ${node_ref}.parameters`);

    return this.namespaceDependency(node_ref, param_value, friendly_name_map);
  }

  private namespaceDependency(node_ref: string, param_value: string, friendly_name_map: { [key: string]: string }): string {

    const bracket_notation_matcher = /\$\{\s*dependencies\[(.*?)\]\./g;
    const dot_notation_matcher = /\$\{\s*dependencies\.(.*?)\./g;

    console.log('namespacing...');
    console.log(param_value);
    let namespaced_dependency = param_value;
    namespaced_dependency = namespaced_dependency.replace(bracket_notation_matcher, (m) => {
      console.log(m);
      const dep = this.extract_friendly_name_from_brackets(m);
      console.log(dep);
      return '${ ' + friendly_name_map[dep] + '.';
    });
    console.log(namespaced_dependency);

    namespaced_dependency = namespaced_dependency.replace(dot_notation_matcher, (m) => {
      console.log(m);
      const dep = this.extract_friendly_name_from_dot_notation(m);
      console.log(dep);
      return '${ ' + friendly_name_map[dep] + '.';
    });

    return namespaced_dependency;
  }

  private extract_friendly_name_from_brackets(match: string) {
    const matches = match.match(/dependencies\['([\s\S]*?)'\]/);
    if (matches && matches.length > 1) {
      console.log(matches[1]);
      return matches[1];
    } else {
      throw new Error('Bad format for dependency:' + match);
    }
  }

  private extract_friendly_name_from_dot_notation(match: string) {
    const matches = match.match(/dependencies\.([\s\S]*?)\./);
    if (matches && matches.length > 1) {
      console.log(matches[1]);
      return matches[1];
    } else {
      throw new Error('Bad format for dependency:' + match);
    }
  }

  private interpolateParamValue(param_value: ParameterValueV2, environment_context: { [key: string]: any }): ParameterValueV2 {
    if (typeof param_value !== 'string') {
      return param_value;
    }
    if (!param_value.includes('${')) {
      return param_value;
    }

    console.log(`interpolating: ${param_value}`);

    Mustache.tags = ['${', '}'];
    return Mustache.render(param_value, environment_context);
  }

  private buildInterfaceEnvParams(node: DependencyNode) {
    const interface_params: { [key: string]: string } = {};
    const gateway_node = this.graph.nodes.find((node) => (node instanceof GatewayNode));
    const gateway_port = gateway_node ? this.gateway_port : '';

    for (const [interface_name, interface_details] of Object.entries(node.interfaces)) {
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

      const port = external_host ? external_port : internal_port;
      const host = external_host ? external_host : internal_host;

      const internal_url = internal_protocol + '://' + internal_host + ':' + internal_port;
      const external_url = external_host ? (external_protocol + '://' + external_host + ':' + external_port) : '';

      const prefix = interface_name === '_default' || Object.keys(node.interfaces).length === 1 ? '' : `${interface_name}_`.toUpperCase();
      interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_HOST`)] = external_host;
      interface_params[this.scopeEnv(node, `${prefix}INTERNAL_HOST`)] = internal_host;
      interface_params[this.scopeEnv(node, `${prefix}HOST`)] = host;

      interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_PORT`)] = external_port;
      interface_params[this.scopeEnv(node, `${prefix}INTERNAL_PORT`)] = internal_port;
      interface_params[this.scopeEnv(node, `${prefix}PORT`)] = port;

      interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_PROTOCOL`)] = external_protocol;
      interface_params[this.scopeEnv(node, `${prefix}INTERNAL_PROTOCOL`)] = internal_protocol;

      interface_params[this.scopeEnv(node, `${prefix}EXTERNAL_URL`)] = external_url;
      interface_params[this.scopeEnv(node, `${prefix}INTERNAL_URL`)] = internal_url;
    }

    return interface_params;
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
