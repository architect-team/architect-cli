import { deserialize, plainToClass, serialize } from 'class-transformer';
import { ValidationError } from 'class-validator';
import { ServiceNode } from '.';
import { ComponentConfig } from './component-config/base';
import { ComponentConfigBuilder } from './component-config/builder';
import { EnvironmentConfig } from './environment-config/base';
import { EnvironmentConfigBuilder } from './environment-config/builder';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import ServiceEdge from './graph/edge/service';
import GatewayNode from './graph/node/gateway';
import InterfacesNode from './graph/node/interfaces';
import { InterfaceSpec } from './service-config/base';
import { Dictionary } from './utils/dictionary';
import { flattenValidationErrors, ValidationErrors } from './utils/errors';
import { escapeJSON, interpolateString, normalizeInterpolation, prefixExpressions, removePrefixForExpressions, replaceBrackets } from './utils/interpolation';
import { ComponentSlugUtils, ComponentVersionSlugUtils, Slugs } from './utils/slugs';
import { validateInterpolation } from './utils/validation';
import VaultManager from './vault-manager';

export default abstract class DependencyManager {
  gateway_port!: number;
  environment!: EnvironmentConfig;
  protected __component_config_cache: Dictionary<ComponentConfig | undefined>;
  protected __graph_cache: Dictionary<DependencyGraph | undefined>;

  protected constructor() {
    this.__component_config_cache = {};
    this.__graph_cache = {};
  }

  async init(environment_config?: EnvironmentConfig): Promise<void> {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.gateway_port = await this.getServicePort(80);
  }

  async getGraph(interpolate = true): Promise<DependencyGraph> {
    const cache_key = `${serialize(this.environment)}-${interpolate}`;
    let graph = this.__graph_cache[cache_key];
    if (!graph) {
      graph = new DependencyGraph();
      const component_map = await this.loadComponents(graph);
      this.addIngressEdges(graph);
      if (interpolate) {
        const interpolated_environment = await this.interpolateEnvironment(graph, this.environment, component_map);
        await this.interpolateComponents(graph, interpolated_environment, component_map);
      }
      this.__graph_cache[cache_key] = graph;
    }
    return graph;
  }

  // Add edges between gateway and component interfaces nodes
  addIngressEdges(graph: DependencyGraph): void {
    const component_edge_map: Dictionary<Dictionary<string>> = {};
    for (const [env_interface, component_interface] of Object.entries(this.environment.getInterfaces())) {
      const components_regex = new RegExp(`\\\${{\\s*components\\.(${ComponentVersionSlugUtils.RegexOptionalTag})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = components_regex.exec(replaceBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, component_name, interface_name] = matches;
      const component = this.environment.getComponents()[component_name];
      if (!component) continue;

      const to = component.getInterfacesRef();
      if (!graph.nodes_map.has(to)) continue;

      if (!component_edge_map[to]) component_edge_map[to] = {};
      component_edge_map[to][env_interface] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(component_edge_map)) {
      const gateway = new GatewayNode();
      graph.addNode(gateway);
      graph.addEdge(new IngressEdge(gateway.ref, to, interfaces_map));
    }
  }

  async loadComponents(graph: DependencyGraph): Promise<Dictionary<ComponentConfig>> {
    const component_map: Dictionary<ComponentConfig> = {};
    const components = Object.values(this.environment.getComponents());
    for (const component of components) {
      await this.loadComponent(graph, component, component_map);
    }
    return component_map;
  }

  async loadComponent(graph: DependencyGraph, component_config: ComponentConfig, component_map: Dictionary<ComponentConfig>) {
    const environment = this.environment;

    const ref = component_config.getRef();
    if (ref in environment.getComponents()) {
      component_config = component_config.merge(environment.getComponents()[ref]);
    } else if (ref.split(':')[1] === 'latest' && component_config.getName() in environment.getComponents()) {
      component_config = component_config.merge(environment.getComponents()[component_config.getName()]);
    }

    const component = await this.loadComponentConfigWrapper(component_config);
    let component_string = serialize(component);
    component_string = replaceBrackets(component_string);
    // Prefix interpolation expressions with components.<name>.
    component_string = prefixExpressions(component_string, normalizeInterpolation(component.getRef()));
    const prefixed_component = deserialize(component.getClass(), component_string) as ComponentConfig;
    component_map[component.getRef()] = prefixed_component;

    // Create interfaces node for component
    if (Object.keys(component.getInterfaces()).length > 0) {
      const node = new InterfacesNode(component.getInterfacesRef());
      graph.addNode(node);
    }

    const ref_map: Dictionary<string> = {};
    // Load component services
    for (const [service_name, service_config] of Object.entries(prefixed_component.getServices())) {
      const node_config = service_config.copy();
      const node = new ServiceNode({
        ref: component.getServiceRef(node_config.getName()),
        node_config,
        local_path: component.getLocalPath(),
      });
      graph.addNode(node);

      ref_map[service_name] = node.ref;
    }

    // Load component dependencies
    for (const [dep_key, dep_value] of Object.entries(component.getDependencies())) {
      const dep_name = dep_value.includes(':') ? `${dep_key}:latest` : `${dep_key}:${dep_value}`;
      const dep_extends = dep_value.includes(':') ? dep_value : `${dep_key}:${dep_value}`;
      const dep_component = ComponentConfigBuilder.buildFromJSON({ extends: dep_extends, name: dep_name });

      if (component_map[dep_component.getRef()]) {
        const first_side_dependency = component.getRef().split(':')[0] in component_map[dep_component.getRef()].getDependencies();
        const second_side_dependency = dep_component.getRef().split(':')[0] in component.getDependencies();
        if (first_side_dependency && second_side_dependency) {
          throw new Error(`Circular component dependency detected (${ component.getRef() } <> ${dep_component.getRef()})`);
        }
      }
      await this.loadComponent(graph, dep_component, component_map);
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
      const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const service_edge_map: Dictionary<Dictionary<string>> = {};
      let matches;
      while ((matches = services_regex.exec(service_string)) != null) {
        const [_, service_name, interface_name] = matches;
        const to = ref_map[service_name];
        if (to === from) continue;
        if (!service_edge_map[to]) service_edge_map[to] = {};
        service_edge_map[to]['service'] = interface_name;
      }
      for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
        const edge = new ServiceEdge(from, to, interfaces_map);
        graph.addEdge(edge);
      }

      // Add edges between services and dependencies inside the component
      const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const dep_edge_map: Dictionary<Dictionary<string>> = {};
      while ((matches = dependencies_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.getDependencies()[dep_name];

        const dep_component = component_map[`${dep_name}:${dep_tag}`];
        const to = dep_component.getInterfacesRef();
        if (!graph.nodes_map.has(to)) continue;

        if (!dep_edge_map[to]) dep_edge_map[to] = {};
        dep_edge_map[to]['service'] = interface_name;
      }

      for (const [to, interfaces_map] of Object.entries(dep_edge_map)) {
        const edge = new ServiceEdge(from, to, interfaces_map);
        graph.addEdge(edge);
      }
    }

    // Add edges between services and the component's interfaces node
    const service_edge_map: Dictionary<Dictionary<string>> = {};
    for (const [component_interface_name, component_interface] of Object.entries(component.getInterfaces())) {
      const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = services_regex.exec(replaceBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, service_name, interface_name] = matches;
      const to = ref_map[service_name];
      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interfaces_map);
      graph.addEdge(edge);
    }
  }

  async interpolateVaults(environment: EnvironmentConfig): Promise<EnvironmentConfig> {
    const vault_manager = new VaultManager(environment.getVaults());

    const environment_string = serialize(environment);
    // Interpolate vault separately before mustache
    const vaults_regex = new RegExp(`\\\${{\\s*vaults\\.(.*?)\\s*}}`, 'g');
    let matches;
    let res = environment_string;
    while ((matches = vaults_regex.exec(environment_string)) != null) {
      const [vault_name, key] = matches[1].split('.');
      const secret = await vault_manager.getSecret(vault_name, key);
      res = res.replace(matches[0], escapeJSON(secret));
    }

    return deserialize(environment.getClass(), res);
  }

  validateComponent(component: ComponentConfig, context: object): ValidationError[] {
    const validation_errors = [];
    // Check required parameters for components
    for (const [pk, pv] of Object.entries(component.getParameters())) {
      if (pv.required !== false && (pv.default === undefined || pv.default === null)) {
        const validation_error = new ValidationError();
        validation_error.property = `components.${component.getName()}.parameters.${pk}`;
        validation_error.target = pv;
        validation_error.value = pv.default;
        validation_error.constraints = { Required: `${pk} is required` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }
    }

    // TODO: Removing the prefix is tedious, but the component map is currently stored prefixed
    return [...validation_errors, ...validateInterpolation(removePrefixForExpressions(serialize(component)), context)];
  }

  validateEnvironment(environment: EnvironmentConfig, enriched_environment: EnvironmentConfig): ValidationError[] {
    let validation_errors: ValidationError[] = [];

    // Check required parameters for environment
    for (const [pk, pv] of Object.entries(environment.getParameters())) {
      if (pv.required !== false && (pv.default === undefined || pv.default === null)) {
        const validation_error = new ValidationError();
        validation_error.property = `parameters.${pk}`;
        validation_error.target = pv;
        validation_error.value = pv.default;
        validation_error.constraints = { Required: `${pk} is required` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }
    }

    // Ignore vault keys
    const ignore_keys = Object.keys(environment.getVaults()).map((vault_key) => `vaults.${vault_key}.`);

    validation_errors = validation_errors.concat(validateInterpolation(serialize(environment), enriched_environment.getContext(), ignore_keys));
    return validation_errors;
  }

  // Aggresive replacement to support periods in environment component keys. ex. `${{ components['concourse:6.1'].interfaces.web.url }}
  normalizeEnvironmentComponents(environment: EnvironmentConfig): EnvironmentConfig {
    const env_component_keys = Object.keys(environment.getComponents());

    const value = replaceBrackets(serialize(environment));

    const mustache_regex = new RegExp(`\\\${{\\s*components.(.*?)\\s*}}`, 'g');
    let matches;
    let res = value;
    while ((matches = mustache_regex.exec(value)) != null) {
      const [full_component_exp, component_exp] = matches;

      let normalized_component_exp = full_component_exp;
      // TODO: Improve check without nested loop
      for (const env_component_key of env_component_keys) {
        if (component_exp.startsWith(`${env_component_key}.`)) {
          normalized_component_exp = normalized_component_exp.replace(env_component_key, normalizeInterpolation(env_component_key));
          break;
        }
      }

      res = res.replace(full_component_exp, normalized_component_exp);
    }
    return deserialize(environment.getClass(), res);
  }

  async interpolateEnvironment(graph: DependencyGraph, environment: EnvironmentConfig, component_map: Dictionary<ComponentConfig>): Promise<EnvironmentConfig> {
    environment = this.normalizeEnvironmentComponents(environment);

    const component_interfaces_ref_map: Dictionary<ComponentConfig> = {};
    for (const component of Object.values(environment.getComponents())) {
      component_interfaces_ref_map[component.getInterfacesRef()] = component_map[component.getRef()];
    }

    // Inject external host/port/protocol for exposed interfaces
    for (const edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      const component = component_interfaces_ref_map[edge.to];
      if (!component) continue;

      for (const [env_interface, interface_name] of Object.entries(edge.interfaces_map)) {
        if (!component.getInterfaces()[interface_name]) {
          component.getInterfaces()[interface_name] = { port: this.gateway_port.toString() };
        }
        const inter = component.getInterfaces()[interface_name];
        if (!inter) { continue; }

        inter.host = `${env_interface}.${this.toExternalHost()}`;
        inter.port = this.gateway_port.toString();
        inter.protocol = this.toExternalProtocol();
        inter.url = `${inter.protocol}://${inter.host}:${inter.port}`;

        component.setInterface(interface_name, inter);
      }
    }

    // Merge in loaded environment components for interpolation `ex. ${{ components.concourse/ci.interfaces.web }}
    const environment_components: Dictionary<ComponentConfig> = {};
    const normalized_component_refs = [];
    for (const [component_name, component] of Object.entries(environment.getComponents())) {
      environment_components[component_name] = component_map[component.getRef()];
      normalized_component_refs.push(`${normalizeInterpolation(component.getRef())}.`);
    }
    let enriched_environment = plainToClass(environment.getClass(), { components: environment_components }) as EnvironmentConfig;
    enriched_environment = enriched_environment.merge(environment);

    const errors = this.validateEnvironment(environment, enriched_environment);
    if (errors.length) {
      throw new ValidationErrors('environment', flattenValidationErrors(errors));
    }

    environment = await this.interpolateVaults(environment);
    enriched_environment = await this.interpolateVaults(enriched_environment);

    const interpolated_environment_string = interpolateString(serialize(environment), enriched_environment.getContext(), normalized_component_refs);

    return deserialize(environment.getClass(), interpolated_environment_string, { enableImplicitConversion: true });
  }

  buildComponentsContext(graph: DependencyGraph, components_map: Dictionary<ComponentConfig>) {
    const context: Dictionary<any> = {};

    const components = Object.values(components_map);

    // Set contexts for all components
    for (const component of components) {
      const normalized_ref = normalizeInterpolation(component.getRef());
      context[normalized_ref] = component.getContext();
      for (const [service_name, service] of Object.entries(component.getServices())) {
        const node = graph.getNodeByRef(component.getServiceRef(service_name)) as ServiceNode;
        for (const interface_name of Object.keys(service.getInterfaces())) {
          const interface_context = this.mapToInterfaceContext(node, interface_name);
          context[normalized_ref].services[service_name].interfaces[interface_name] = interface_context;
        }
      }
    }
    // Set contexts for all component dependencies (Important to show correct interpolation errors)
    // Ex. ${{ dependencies.api.interfaces.invalid }}
    for (const component of components) {
      const normalized_ref = normalizeInterpolation(component.getRef());
      for (const [dep_key, dep_tag] of Object.entries(component.getDependencies())) {
        const dep_ref = dep_tag.includes(':') ? `${dep_key}:latest` : `${dep_key}:${dep_tag}`;
        const dep_component = components_map[dep_ref];
        context[normalized_ref].dependencies[dep_key] = { ...context[normalizeInterpolation(dep_component.getRef())] };
        // Remove dependencies of dependencies
        delete context[normalized_ref].dependencies[dep_key].dependencies;
      }
    }

    return context;
  }

  async interpolateComponents(graph: DependencyGraph, interpolated_environment: EnvironmentConfig, component_map: Dictionary<ComponentConfig>) {
    // Prefix interpolation expressions with components.<name>.
    const prefixed_component_map: Dictionary<ComponentConfig> = {};
    for (let component of Object.values(component_map)) {
      const environment_component = interpolated_environment.getComponents()[component.getRef()] || interpolated_environment.getComponents()[component.getName()];
      // Set default component parameter values from environment parameters
      for (const [parameter_key, parameter] of Object.entries(component.getParameters())) {
        const environment_parameter = interpolated_environment.getParameters()[parameter_key];
        if (environment_parameter) {
          parameter.default = environment_parameter.default;
          component.setParameter(parameter_key, parameter);
        }
      }
      if (environment_component) {
        component = component.merge(environment_component);
      }
      prefixed_component_map[component.getRef()] = component;
    }

    const context = this.buildComponentsContext(graph, prefixed_component_map);

    // Validate components
    for (const component of Object.values(prefixed_component_map)) {
      const errors = this.validateComponent(component, context[normalizeInterpolation(component.getRef())]);
      if (errors.length) {
        throw new ValidationErrors(component.getRef(), flattenValidationErrors(errors));
      }
    }

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

  protected abstract toExternalProtocol(): string;
  protected abstract toExternalHost(): string;
  protected abstract toInternalHost(node: ServiceNode): string;
  protected toInternalPort(node: ServiceNode, interface_name: string): string {
    return node.interfaces[interface_name].port;
  }

  private mapToInterfaceContext(node: ServiceNode, interface_name: string): InterfaceSpec {
    const interface_details = node.interfaces[interface_name];

    let internal_host: string, internal_port: string, internal_protocol: string;
    if (node.is_external) {
      if (!interface_details.host) {
        throw new Error('External node needs to override the host');
      }
      internal_host = interface_details.host;
      internal_port = interface_details.port;
      internal_protocol = interface_details.protocol || 'https';
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
