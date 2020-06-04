import { deserialize, serialize } from 'class-transformer';
import Mustache from 'mustache';
import { ServiceNode } from '.';
import { ComponentConfig } from './component-config/base';
import { ComponentConfigBuilder } from './component-config/builder';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import GatewayNode from './graph/node/gateway';
import { ParameterValue, ServiceConfig } from './service-config/base';
import { ServiceConfigV1 } from './service-config/v1';
import { Dictionary } from './utils/dictionary';
import { EnvironmentInterfaceContext, EnvironmentInterpolationContext, InterfaceContext, InterpolationContext } from './utils/interpolation/interpolation-context';
import { IMAGE_REGEX, REPOSITORY_REGEX } from './utils/validation';
import VaultManager from './vault-manager';

export default abstract class DependencyManager {
  abstract graph: DependencyGraph;
  gateway_port!: number;
  _environment!: EnvironmentConfig;
  protected vault_manager!: VaultManager;
  protected __component_config_cache: Dictionary<ComponentConfig | undefined>;
  protected _component_map: Dictionary<ComponentConfig>;

  protected constructor() {
    this.__component_config_cache = {};
    this._component_map = {};
  }

  async init(environment_config?: EnvironmentConfig): Promise<void> {
    this._environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.vault_manager = new VaultManager(this._environment.getVaults());
    this.gateway_port = await this.getServicePort(80);
  }

  async loadComponents(): Promise<void> {
    const components = Object.values(this._environment.getComponents());
    for (const component of components) {
      await this.loadComponent(component);
    }
  }

  async loadComponent(component_config: ComponentConfig) {
    const ref = component_config.getRef();
    if (ref in this._environment.getComponents()) {
      component_config = component_config.merge(this._environment.getComponents()[ref]);
    } else if (ref.split(':')[1] === 'latest' && component_config.getName() in this._environment.getComponents()) {
      component_config = component_config.merge(this._environment.getComponents()[component_config.getName()]);
    }

    const component = await this.loadComponentConfigWrapper(component_config);
    this._component_map[component.getRef()] = component;

    const ref_map: Dictionary<string> = {};
    // Load component services
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const node_config = this.getNodeConfig(service_config);

      // TODO: Cleanup this is terrible
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      service_config.name = component.getServiceRef(service_config.getName());
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      node_config.name = component.getServiceRef(node_config.getName());

      const node = this.loadServiceNode(service_config, node_config);
      this.graph.addNode(node);

      ref_map[service_name] = node.ref;
    }

    // Load component dependencies
    for (const [dep_key, dep_value] of Object.entries(component.getDependencies())) {
      const dep_component = ComponentConfigBuilder.buildFromJSON({ extends: `${dep_key}:${dep_value}`, name: `${dep_key}:${dep_value}` });
      await this.loadComponent(dep_component);
    }

    // Add edges to services inside component
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const service_string = serialize(service_config);

      const start_regex = `(?:\\[\\s*\\\\"|\\[\\s*\\'|\\.)`;
      const end_regex = `(?:\\\\"\\s*\\]|\\'\\s*\\])?\\.`;

      const services_regex = new RegExp(`\\\${\\s*services${start_regex}(${IMAGE_REGEX})?${end_regex}`, 'g');
      const from = ref_map[service_name];

      let matches;
      while ((matches = services_regex.exec(service_string)) != null) {
        const to = ref_map[matches[1]];
        const edge = new ServiceEdge(from, to);
        this.graph.addEdge(edge);
      }

      const dependencies_regex = new RegExp(`\\\${\\s*dependencies${start_regex}(${REPOSITORY_REGEX})?${end_regex}services${start_regex}(${IMAGE_REGEX})?${end_regex}`, 'g');
      while ((matches = dependencies_regex.exec(service_string)) != null) {
        const tag = component.getDependencies()[matches[1]];
        const to = `${matches[1]}/${matches[2]}:${tag}`;
        const edge = new ServiceEdge(from, to);
        this.graph.addEdge(edge);
      }
    }
  }

  public interpolateString(param_value: string, component_context: InterpolationContext): string {
    Mustache.tags = ['${', '}']; // sets custom delimiters
    Mustache.escape = function (text) { return text; }; // turns off HTML escaping
    //TODO:77: add validation logic to catch expressions that don't refer to an existing path
    return Mustache.render(param_value, component_context);
  }

  async loadParameters() {
    const env_parameters = this._environment.getParameters();
    const interface_context = this.buildEnvironmentInterfaceContext(this.graph);
    const node_component_map: Dictionary<string> = {};

    const component_context_map: EnvironmentInterpolationContext = {};
    for (const component of Object.values(this._component_map) as Array<ComponentConfig>) {
      const parameters: Dictionary<ParameterValue> = {};
      for (const [parameter_key, parameter] of Object.entries(component.getParameters())) {
        parameters[parameter_key] = parameter.default;
      }
      for (const parameter_key of Object.keys(parameters)) {
        if (parameter_key in env_parameters) {
          parameters[parameter_key] = env_parameters[parameter_key];
        }
      }

      const services: any = {};
      for (const service_key of Object.keys(component.getServices())) {
        services[service_key] = {
          interfaces: interface_context[component.getServiceRef(service_key)],
        };
        node_component_map[component.getServiceRef(service_key)] = component.getRef();
      }

      component_context_map[component.getRef()] = {
        parameters,
        services,
        dependencies: {},
      };
    }

    // Loop through dependencies and set contexts
    for (const component of Object.values(this._component_map) as Array<ComponentConfig>) {
      const dependencies: any = {};
      for (const [dep_key, dep_tag] of Object.entries(component.getDependencies())) {
        dependencies[dep_key] = { ...component_context_map[`${dep_key}:${dep_tag}`] };
        delete dependencies[dep_key].dependencies;
      }
      component_context_map[component.getRef()].dependencies = dependencies;
    }

    for (const node of this.graph.nodes) {
      if (!(node instanceof ServiceNode)) continue;

      const component_ref = node_component_map[node.ref];
      const component_context = component_context_map[component_ref];

      // TODO: Support brackets ${ dependencies['concourse/ci'].services... }
      const interpolated_node_config_string = this.interpolateString(serialize(node.node_config), component_context);
      node.node_config = deserialize(ServiceConfigV1, interpolated_node_config_string, { enableImplicitConversion: true });
    }
  }

  getNodeConfig(service_config: ServiceConfig) {
    return service_config.copy();
  }

  protected scopeEnv(node: DependencyNode, key: string) {
    const prefix = node.normalized_ref.replace(/[.-]/g, '_');
    return `${prefix}__arc__${key}`;
  }

  protected abstract toExternalProtocol(node: DependencyNode, interface_key: string): string;
  protected abstract toExternalHost(node: DependencyNode, interface_key: string): string;
  protected abstract toInternalHost(node: DependencyNode): string;
  protected toInternalPort(node: DependencyNode, interface_name: string): number {
    return node.interfaces[interface_name].port;
  }

  private buildEnvironmentInterfaceContext(graph: DependencyGraph): EnvironmentInterfaceContext {
    const environment_interface_context: EnvironmentInterfaceContext = {};
    for (const node of this.graph.nodes) {
      environment_interface_context[node.ref] = {};
      for (const interface_name of Object.keys(node.interfaces)) {
        environment_interface_context[node.ref][interface_name] = this.mapToInterfaceContext(node, interface_name);
      }
    }
    return environment_interface_context;
  }

  private mapToInterfaceContext(node: DependencyNode, interface_name: string): InterfaceContext {
    const gateway_node = this.graph.nodes.find((node) => (node instanceof GatewayNode));
    const gateway_port = gateway_node ? this.gateway_port : undefined;
    const interface_details = node.interfaces[interface_name];

    let external_host: string, internal_host: string, external_port: number | undefined, internal_port: number, external_protocol: string | undefined, internal_protocol: string;
    if (node.is_external) {
      if (!interface_details.host) {
        throw new Error('External node needs to override the host');
      }
      external_host = interface_details.host;
      internal_host = interface_details.host;
      external_port = interface_details.port;
      internal_port = interface_details.port;
      external_protocol = 'https';
      internal_protocol = 'https';
    } else {
      external_host = this.toExternalHost(node, interface_name);
      internal_host = this.toInternalHost(node);
      external_port = gateway_port;
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
      },
    };
  }

  /**
   * Returns a port available for a service to run on. Primary use-case is to be
   * extended by the CLI to return a dynamic available port.
   */
  async getServicePort(starting_port?: number): Promise<number> {
    return Promise.resolve(starting_port || 80);
  }

  abstract async loadComponentConfig(initial_config: ComponentConfig): Promise<ComponentConfig>;

  protected async loadComponentConfigWrapper(initial_config: ComponentConfig): Promise<ComponentConfig> {
    let service_extends = initial_config.getExtends();
    const seen_extends = new Set();
    let component_config = initial_config;
    while (service_extends) {
      if (seen_extends.has(service_extends)) {
        throw new Error(`Circular service extends detected: ${service_extends}`);
      }
      seen_extends.add(service_extends);
      let cached_config = this.__component_config_cache[service_extends];
      if (!cached_config) {
        cached_config = await this.loadComponentConfig(component_config);
        this.__component_config_cache[service_extends] = cached_config;
      }
      service_extends = cached_config.getExtends();
      component_config = component_config ? cached_config.merge(component_config) : cached_config;
    }
    return component_config;
  }

  loadServiceNode(service_config: ServiceConfig, node_config: ServiceConfig): ServiceNode {
    return new ServiceNode({
      service_config,
      node_config,
      image: node_config.getImage(),
      digest: node_config.getDigest(),
    });
  }
}
