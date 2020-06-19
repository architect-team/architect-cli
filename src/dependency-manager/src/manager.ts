import { deserialize, plainToClass, serialize } from 'class-transformer';
import { ServiceNode } from '.';
import { ComponentConfig } from './component-config/base';
import { ComponentConfigBuilder } from './component-config/builder';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import GatewayNode from './graph/node/gateway';
import InterfacesNode from './graph/node/interfaces';
import { ServiceConfig, ServiceInterfaceSpec } from './service-config/base';
import { Dictionary } from './utils/dictionary';
import { escapeJSON, interpolateString, prefixExpressions, replaceBrackets } from './utils/interpolation';
import { IMAGE_REGEX, REPOSITORY_REGEX } from './utils/validation';
import VaultManager from './vault-manager';

export default abstract class DependencyManager {
  gateway_port!: number;
  environment!: EnvironmentConfig;
  protected __component_config_cache: Dictionary<ComponentConfig | undefined>;
  protected _component_map: Dictionary<ComponentConfig>;

  protected constructor() {
    this.__component_config_cache = {};
    this._component_map = {};
  }

  async init(environment_config?: EnvironmentConfig): Promise<void> {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.gateway_port = await this.getServicePort(80);
  }

  async getGraph(): Promise<DependencyGraph> {
    const graph = new DependencyGraph();
    const component_map = await this.loadComponents(graph);
    this.addIngressEdges(graph);
    const interpolated_environment = await this.interpolateEnvironment(this.environment, component_map);
    await this.interpolateComponents(graph, interpolated_environment, component_map);
    return graph;
  }

  // Add edges between gateway and component interfaces nodes
  addIngressEdges(graph: DependencyGraph): void {
    let interfaces_string = serialize(this.environment.getInterfaces());
    interfaces_string = replaceBrackets(interfaces_string);
    const components_regex = new RegExp(`\\\${\\s*components\\.(${REPOSITORY_REGEX})?\\.interfaces\\.(${IMAGE_REGEX})?\\.`, 'g');
    const component_edge_map: Dictionary<Set<string>> = {};
    let matches;
    while ((matches = components_regex.exec(interfaces_string)) != null) {
      const [_, component_name, interface_name] = matches;
      const component = this.environment.getComponents()[component_name];
      if (!component) continue;

      const to = component.getInterfacesRef();
      if (!graph.nodes_map.has(to)) continue;

      if (!component_edge_map[to]) component_edge_map[to] = new Set();
      component_edge_map[to].add(interface_name);
    }
    for (const [to, interface_names] of Object.entries(component_edge_map)) {
      const gateway = new GatewayNode();
      graph.addNode(gateway);
      graph.addEdge(new IngressEdge(gateway.ref, to, interface_names));
    }
  }

  async loadComponents(graph: DependencyGraph): Promise<Dictionary<ComponentConfig>> {
    const components = Object.values(this.environment.getComponents());
    for (const component of components) {
      await this.loadComponent(graph, component);
    }
    // TODO: Remove component map and use an aggregator
    return this._component_map;
  }

  async loadComponent(graph: DependencyGraph, component_config: ComponentConfig) {
    const environment = this.environment;

    const ref = component_config.getRef();
    if (ref in environment.getComponents()) {
      component_config = component_config.merge(environment.getComponents()[ref]);
    } else if (ref.split(':')[1] === 'latest' && component_config.getName() in environment.getComponents()) {
      component_config = component_config.merge(environment.getComponents()[component_config.getName()]);
    }

    const component = await this.loadComponentConfigWrapper(component_config);
    const load_dependencies = !(component.getRef() in this._component_map); // Detect circular dependencies
    this._component_map[component.getRef()] = component;

    // Create interfaces node for component
    if (Object.keys(component.getInterfaces()).length > 0) {
      const node = new InterfacesNode(component.getInterfacesRef());
      graph.addNode(node);
    }

    const ref_map: Dictionary<string> = {};
    // Load component services
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const node_config = this.getNodeConfig(service_config);

      const node = new ServiceNode({
        ref: component.getServiceRef(node_config.getName()),
        service_config,
        node_config,
        local: component.getExtends()?.startsWith('file:'),
      });
      graph.addNode(node);

      ref_map[service_name] = node.ref;
    }

    // Load component dependencies
    if (load_dependencies) {
      for (const [dep_key, dep_value] of Object.entries(component.getDependencies())) {
        const dep_name = dep_value.includes(':') ? `${dep_key}:latest` : `${dep_key}:${dep_value}`;
        const dep_extends = dep_value.includes(':') ? dep_value : `${dep_key}:${dep_value}`;
        const dep_component = ComponentConfigBuilder.buildFromJSON({ extends: dep_extends, name: dep_name });
        await this.loadComponent(graph, dep_component);
      }
    }

    // Add edges to services inside component
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const from = ref_map[service_name];
      const from_node = graph.getNodeByRef(from);
      if (from_node.is_external) {
        continue;
      }

      let service_string = serialize(service_config);
      service_string = replaceBrackets(service_string);

      // Add edges between services inside the component
      const services_regex = new RegExp(`\\\${\\s*services\\.(${IMAGE_REGEX})?\\.interfaces\\.(${IMAGE_REGEX})?\\.`, 'g');
      const service_edge_map: Dictionary<Set<string>> = {};
      let matches;
      while ((matches = services_regex.exec(service_string)) != null) {
        const [_, service_name, interface_name] = matches;
        const to = ref_map[service_name];
        if (!service_edge_map[to]) service_edge_map[to] = new Set();
        service_edge_map[to].add(interface_name);
      }
      for (const [to, interface_names] of Object.entries(service_edge_map)) {
        const edge = new ServiceEdge(from, to, interface_names);
        graph.addEdge(edge);
      }

      // Add edges between services and dependencies inside the component
      const dependencies_regex = new RegExp(`\\\${\\s*dependencies\\.(${REPOSITORY_REGEX})?\\.interfaces\\.(${IMAGE_REGEX})?\\.`, 'g');
      const dep_edge_map: Dictionary<Set<string>> = {};
      while ((matches = dependencies_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.getDependencies()[dep_name];

        const dep_component = this._component_map[`${dep_name}:${dep_tag}`];
        const to = dep_component.getInterfacesRef();
        if (!graph.nodes_map.has(to)) continue;

        if (!dep_edge_map[to]) dep_edge_map[to] = new Set();
        dep_edge_map[to].add(interface_name);
      }

      for (const [to, interface_names] of Object.entries(dep_edge_map)) {
        const edge = new ServiceEdge(from, to, interface_names);
        graph.addEdge(edge);
      }
    }

    // Add edges between services and the component's interfaces node
    let interfaces_string = serialize(component.getInterfaces());
    interfaces_string = replaceBrackets(interfaces_string);
    const services_regex = new RegExp(`\\\${\\s*services\\.(${IMAGE_REGEX})?\\.interfaces\\.(${IMAGE_REGEX})?\\.`, 'g');
    const service_edge_map: Dictionary<Set<string>> = {};
    let matches;
    while ((matches = services_regex.exec(interfaces_string)) != null) {
      const [_, service_name, interface_name] = matches;
      const to = ref_map[service_name];
      if (!service_edge_map[to]) service_edge_map[to] = new Set();
      service_edge_map[to].add(interface_name);
    }
    for (const [to, interface_names] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interface_names);
      graph.addEdge(edge);
    }
  }

  async interpolateVaults(environment: EnvironmentConfig): Promise<EnvironmentConfig> {
    const vault_manager = new VaultManager(environment.getVaults());

    let environment_string = serialize(environment);
    environment_string = replaceBrackets(environment_string);

    // Interpolate vault separately before mustache
    const vaults_regex = new RegExp(`\\\${\\s*vaults\\.(.*?)\\s*}`, 'g');
    let matches;
    let res = environment_string;
    while ((matches = vaults_regex.exec(environment_string)) != null) {
      const [vault_name, key] = matches[1].split('.');
      const secret = await vault_manager.getSecret(vault_name, key);
      res = res.replace(matches[0], escapeJSON(secret));
    }

    return deserialize(environment.getClass(), res);
  }

  async interpolateEnvironment(environment: EnvironmentConfig, component_map: Dictionary<ComponentConfig>): Promise<EnvironmentConfig> {
    environment = await this.interpolateVaults(environment);

    // Merge in loaded environment components for interpolation `ex. ${ components.concourse/ci.interfaces.web }
    const environment_components: Dictionary<ComponentConfig> = {};
    for (const [component_name, component] of Object.entries(environment.getComponents())) {
      environment_components[component_name] = component_map[component.getRef()];
    }
    let enriched_environment = plainToClass(environment.getClass(), { components: environment_components }) as EnvironmentConfig;
    enriched_environment = enriched_environment.merge(environment);

    // Inject external host/port/protocol for exposed interfaces
    // TODO: Consolidate with addIngressEdges
    for (const [env_interface, component_interface] of Object.entries(environment.getInterfaces())) {
      const components_regex = new RegExp(`\\\${\\s*components\\.(${REPOSITORY_REGEX})?\\.interfaces\\.(${IMAGE_REGEX})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = components_regex.exec(component_interface.url!);
      if (!matches) continue;

      const [_, component_name, interface_name] = matches;
      const component = environment.getComponents()[component_name];
      if (!component) continue;

      if (!component.getInterfaces()[interface_name]) {
        component.getInterfaces()[interface_name] = {};
      }
      const inter = component.getInterfaces()[interface_name];

      inter.host = `${env_interface}.${this.toExternalHost()}`;
      inter.port = this.gateway_port.toString();
      inter.protocol = this.toExternalProtocol();
      inter.url = `${inter.protocol}://${inter.host}:${inter.port}`;
    }

    // TODO: Include in interpolation for components so that we don't have to ignore services
    const interpolated_environment_string = interpolateString(serialize(environment), enriched_environment.getContext(), ['services.']);

    return deserialize(environment.getClass(), interpolated_environment_string, { enableImplicitConversion: true });
  }

  buildComponentsContext(graph: DependencyGraph, components_map: Dictionary<ComponentConfig>) {
    const context: Dictionary<any> = {};

    const components = Object.values(components_map);

    // Set contexts for all components
    for (const component of components) {
      context[component.getNormalizedRef()] = component.getContext();
      for (const [service_name, service] of Object.entries(component.getServices())) {
        const node = graph.getNodeByRef(component.getServiceRef(service_name)) as ServiceNode;
        for (const interface_name of Object.keys(service.getInterfaces())) {
          const interface_context = this.mapToInterfaceContext(graph, node, interface_name);
          context[component.getNormalizedRef()].services[service_name].interfaces[interface_name] = interface_context;
        }
      }
    }
    // Set contexts for all component dependencies (Important to show correct interpolation errors)
    // Ex. ${ dependencies.api.interfaces.invalid }
    for (const component of components) {
      for (const [dep_key, dep_tag] of Object.entries(component.getDependencies())) {
        const dep_ref = dep_tag.includes(':') ? `${dep_key}:latest` : `${dep_key}:${dep_tag}`;
        const dep_component = components_map[dep_ref];
        context[component.getNormalizedRef()].dependencies[dep_key] = { ...context[dep_component.getNormalizedRef()] };
        // Remove dependencies of dependencies
        delete context[component.getNormalizedRef()].dependencies[dep_key].dependencies;
      }
    }

    return context;
  }

  async interpolateComponents(graph: DependencyGraph, interpolated_environment: EnvironmentConfig, component_map: Dictionary<ComponentConfig>) {
    // Prefix interpolation expressions with components.<name>.
    const prefixed_component_map: Dictionary<ComponentConfig> = {};
    for (const component of Object.values(component_map)) {
      let component_string = serialize(component);
      component_string = replaceBrackets(component_string);
      component_string = prefixExpressions(component_string, component.getNormalizedRef());

      let prefixed_component = deserialize(component.getClass(), component_string);
      const environment_component = interpolated_environment.getComponents()[component.getRef()] || interpolated_environment.getComponents()[component.getName()];
      if (environment_component) {
        prefixed_component = prefixed_component.merge(environment_component);
      }
      prefixed_component_map[component.getRef()] = prefixed_component;
    }

    const context = this.buildComponentsContext(graph, prefixed_component_map);

    const full_environment_json: any = { components: prefixed_component_map };
    const full_environment = plainToClass(this.environment.getClass(), full_environment_json);

    const interpolated_environment_string = interpolateString(serialize(full_environment), context);
    const environment = deserialize(this.environment.getClass(), interpolated_environment_string, { enableImplicitConversion: true }) as EnvironmentConfig;
    for (const component of Object.values(environment.getComponents())) {
      for (const [service_name, service] of Object.entries(component.getServices())) {
        const node = graph.getNodeByRef(component.getServiceRef(service_name)) as ServiceNode;
        node.node_config = service;
      }
    }
  }

  getNodeConfig(service_config: ServiceConfig) {
    return service_config.copy();
  }

  protected abstract toExternalProtocol(): string;
  protected abstract toExternalHost(): string;
  protected abstract toInternalHost(node: DependencyNode): string;
  protected toInternalPort(node: DependencyNode, interface_name: string): string {
    return node.interfaces[interface_name].port;
  }

  private mapToInterfaceContext(graph: DependencyGraph, node: ServiceNode, interface_name: string): ServiceInterfaceSpec {
    const interface_details = node.interfaces[interface_name];

    let internal_host: string, internal_port: string, internal_protocol: string;
    if (node.is_external) {
      if (!interface_details.host) {
        throw new Error('External node needs to override the host');
      }
      internal_host = interface_details.host;
      internal_port = interface_details.port;
      internal_protocol = 'https';
    } else {
      internal_host = this.toInternalHost(node);
      internal_port = this.toInternalPort(node, interface_name);
      internal_protocol = interface_details.protocol || 'http';
    }

    const internal_url = internal_protocol + '://' + internal_host + ':' + internal_port;

    return {
      host: internal_host,
      port: internal_port,
      protocol: internal_protocol,
      url: internal_url,
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
    const configs = [initial_config];
    while (service_extends) {
      if (seen_extends.has(service_extends)) {
        throw new Error(`Circular service extends detected: ${service_extends}`);
      }
      seen_extends.add(service_extends);
      let cached_config = this.__component_config_cache[service_extends];
      if (!cached_config) {
        cached_config = await this.loadComponentConfig(configs[0]);
        this.__component_config_cache[service_extends] = cached_config;
      }
      service_extends = cached_config.getExtends();
      configs.unshift(cached_config);
    }

    let res;
    for (const config of configs) {
      res = res ? res.merge(config) : config;
    }
    return res as ComponentConfig;
  }
}
