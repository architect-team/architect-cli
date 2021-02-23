import { classToClass, deserialize, plainToClass, serialize } from 'class-transformer';
import { ValidationError } from 'class-validator';
import { isMatch } from 'matcher';
import { ServiceNode } from '.';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import ServiceEdge from './graph/edge/service';
import GatewayNode from './graph/node/gateway';
import InterfacesNode from './graph/node/interfaces';
import { TaskNode } from './graph/node/task';
import { InterfaceSpec } from './spec/common/interface-spec';
import { ComponentConfigBuilder } from './spec/component/component-builder';
import { ComponentConfig } from './spec/component/component-config';
import { EnvironmentConfigBuilder } from './spec/environment/environment-builder';
import { EnvironmentConfig } from './spec/environment/environment-config';
import { ValuesConfig } from './spec/values/values';
import { Dictionary } from './utils/dictionary';
import { flattenValidationErrors, ValidationErrors } from './utils/errors';
import { interpolateString, normalizeInterpolation, prefixExpressions, removePrefixForExpressions, replaceBrackets } from './utils/interpolation';
import { ComponentSlugUtils, ComponentVersionSlugUtils, Slugs } from './utils/slugs';
import { validateInterpolation } from './utils/validation';

export default abstract class DependencyManager {
  gateway_port!: number;
  environment!: EnvironmentConfig;
  values_dictionary!: Dictionary<Dictionary<string>>;
  protected __component_config_cache: Dictionary<ComponentConfig | undefined>;
  protected __graph_cache: Dictionary<DependencyGraph | undefined>;

  protected constructor() {
    this.__component_config_cache = {};
    this.__graph_cache = {};
  }

  async init(environment_config?: EnvironmentConfig, values_dictionary: Dictionary<Dictionary<string>> = {}): Promise<void> {
    this.environment = environment_config || EnvironmentConfigBuilder.buildFromJSON({});
    this.gateway_port = await this.getServicePort(80);

    ValuesConfig.validate(values_dictionary);
    this.values_dictionary = values_dictionary;
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

    const service_ref_map: Dictionary<string> = {};
    // Load component services
    for (const [service_name, service_config] of Object.entries(prefixed_component.getServices())) {
      const node_config = service_config.copy();
      const node = new ServiceNode({
        ref: component.getServiceRef(node_config.getName()),
        node_config,
        local_path: component.getLocalPath(),
        artifact_image: prefixed_component.getArtifactImage(),
      });
      graph.addNode(node);

      service_ref_map[service_name] = node.ref;
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(prefixed_component.getTasks())) {
      const node_config = task_config.copy();
      const node = new TaskNode({
        ref: component.getTaskRef(node_config.getName()),
        node_config,
        local_path: component.getLocalPath(),
      });
      graph.addNode(node);

      service_ref_map[task_name] = node.ref;
    }

    // Load component dependencies
    for (const [dep_key, dep_value] of Object.entries(component.getDependencies())) {
      const dep_name = dep_value.includes(':') ? `${dep_key}:latest` : `${dep_key}:${dep_value}`;
      const dep_extends = dep_value.includes(':') ? dep_value : `${dep_key}:${dep_value}`;
      const dep_component = ComponentConfigBuilder.buildFromJSON({ extends: dep_extends, name: dep_name });

      if (component_map[dep_component.getRef()] && ComponentVersionSlugUtils.toComponentSlug(component.getRef()) in component_map[dep_component.getRef()].getDependencies()) {
        throw new Error(`Circular component dependency detected (${component.getRef()} <> ${dep_component.getRef()})`);
      }
      await this.loadComponent(graph, dep_component, component_map);
    }

    // Add edges FROM services to other services and dependencies
    for (const [service_name, service_config] of Object.entries({ ...component.getTasks(), ...component.getServices() })) {
      const from = service_ref_map[service_name];
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
        const to = service_ref_map[service_name];
        if (to === from) continue;
        if (!service_edge_map[to]) service_edge_map[to] = {};
        service_edge_map[to][`service->${interface_name}`] = interface_name;
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
        dep_edge_map[to][`service->${interface_name}`] = interface_name;
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
      const to = service_ref_map[service_name];
      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interfaces_map);
      graph.addEdge(edge);
    }

    for (const [component_interface_name, component_interface] of Object.entries(component.getInterfaces())) {
      const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = dependencies_regex.exec(replaceBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, dep_name, interface_name] = matches;
      const dep_tag = component.getDependencies()[dep_name];

      const dep_component = component_map[`${dep_name}:${dep_tag}`];
      const to = dep_component.getInterfacesRef();
      if (!graph.nodes_map.has(to)) continue;

      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interfaces_map);
      graph.addEdge(edge);
    }
  }

  validateComponent(component: ComponentConfig, context: object, ignore_keys: string[] = []): ValidationError[] {
    const validation_errors = [];
    // Check required parameters for components
    for (const [pk, pv] of Object.entries(component.getParameters())) {
      if (pv.required !== 'false' && (pv.default === undefined || pv.default === null)) {
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
    return [...validation_errors, ...validateInterpolation(removePrefixForExpressions(serialize(component)), context, ignore_keys)];
  }

  validateEnvironment(environment: EnvironmentConfig, enriched_environment: EnvironmentConfig): ValidationError[] {
    let validation_errors: ValidationError[] = [];

    // Check required parameters for environment
    for (const [pk, pv] of Object.entries(environment.getParameters())) {
      if (pv.required !== 'false' && (pv.default === undefined || pv.default === null)) {
        const validation_error = new ValidationError();
        validation_error.property = `parameters.${pk}`;
        validation_error.target = pv;
        validation_error.value = pv.default;
        validation_error.constraints = { Required: `${pk} is required` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }
    }
    validation_errors = validation_errors.concat(validateInterpolation(serialize(environment), enriched_environment.getContext(), []));
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
      component_interfaces_ref_map[component.getInterfacesRef()] = classToClass(component_map[component.getRef()]); // make copy to avoid actually altering component passed in
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

    const interpolated_environment_string = interpolateString(serialize(environment), enriched_environment.getContext(), normalized_component_refs);

    return deserialize(environment.getClass(), interpolated_environment_string, { enableImplicitConversion: true });
  }

  async buildComponentsContext(graph: DependencyGraph, components_map: Dictionary<ComponentConfig>) {
    const context: Dictionary<any> = {};

    const components = Object.values(components_map);

    const architect_context = await this.getArchitectContext(graph, components_map);

    // Set contexts for all components
    for (const component of components) {
      const normalized_ref = normalizeInterpolation(component.getRef());
      context[normalized_ref] = component.getContext();

      if (architect_context) {
        context[normalized_ref].environment = classToClass(architect_context.environment);
        context[normalized_ref].architect = classToClass(architect_context);
        context[normalized_ref].architect.environment = {}; // remove environment from architect context as it shouldn't really be accessible that way in interpolation
      }

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
    const environment_components = interpolated_environment.getComponents();
    // Prefix interpolation expressions with components.<name>.
    const prefixed_component_map: Dictionary<ComponentConfig> = {};

    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(this.values_dictionary).sort();
    const sorted_values_dict: Dictionary<Dictionary<string>> = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = this.values_dictionary[key];
    }

    for (let component of Object.values(component_map)) {
      let environment_component = environment_components[component.getRef()];
      const component_parameters = component.getParameters();

      if (!environment_component) {
        const generic_environment_component = environment_components[component.getName()];
        if (generic_environment_component) {
          const environment_component_extends = generic_environment_component.getExtends();
          if (!environment_component_extends || environment_component_extends === component.getExtends()) {
            environment_component = generic_environment_component;
          }
        }
      }

      // Set default component parameter values from environment parameters
      for (const [parameter_key, parameter] of Object.entries(component_parameters)) {
        const environment_parameter = interpolated_environment.getParameters()[parameter_key];
        if (environment_parameter) {
          parameter.default = environment_parameter.default;
          component.setParameter(parameter_key, parameter);
        }
      }

      // add values from values file to all existing, matching components
      for (const [pattern, params] of Object.entries(sorted_values_dict)) {
        const component_has_tag = component.getRef().includes(':');
        if (isMatch(component_has_tag ? component.getRef() : `${component.getRef()}:latest`, [pattern])) {
          for (const [param_key, param_value] of Object.entries(params)) {
            if (component_parameters[param_key]) {
              component.setParameter(param_key, param_value);
            }
          }
        }
      }

      if (environment_component) {
        component = component.merge(environment_component);
      }
      prefixed_component_map[component.getRef()] = component;
    }

    const context = await this.buildComponentsContext(graph, prefixed_component_map);

    // Validate components
    for (const component of Object.values(prefixed_component_map)) {
      const errors = this.validateComponent(component, context[normalizeInterpolation(component.getRef())]);
      if (errors.length) {
        throw new ValidationErrors(component.getRef(), flattenValidationErrors(errors));
      }
    }

    const full_environment_json: any = { components: prefixed_component_map };
    const full_environment = plainToClass(this.environment.getClass(), full_environment_json);

    const ignore_keys = Object.values(prefixed_component_map).map((component) => `${normalizeInterpolation(component.getRef())}.architect.`);
    const interpolated_environment_string = interpolateString(serialize(full_environment), context, ignore_keys);
    const environment = deserialize(this.environment.getClass(), interpolated_environment_string, { enableImplicitConversion: true }) as EnvironmentConfig;

    for (const component of Object.values(environment.getComponents())) {
      for (const [service_name, service] of Object.entries(component.getServices())) {
        const node = graph.getNodeByRef(component.getServiceRef(service_name)) as ServiceNode;
        node.node_config = service;
      }
      for (const [task_name, task] of Object.entries(component.getTasks())) {
        const node = graph.getNodeByRef(component.getTaskRef(task_name)) as TaskNode;
        node.node_config = task;
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

  abstract loadComponentConfig(initial_config: ComponentConfig): Promise<ComponentConfig>;

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

  protected generateEnvironmentIngresses(graph: DependencyGraph, components_map: Dictionary<ComponentConfig>): Dictionary<Dictionary<InterfaceSpec>> {
    const components_map_copy = classToClass(components_map);
    const component_interfaces_ref_map: Dictionary<ComponentConfig> = {};
    for (const component of Object.values(components_map_copy)) {
      component_interfaces_ref_map[component.getInterfacesRef()] = components_map_copy[component.getRef()];
    }

    for (const edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      const component = component_interfaces_ref_map[edge.to];
      for (const [env_interface, interface_name] of Object.entries(edge.interfaces_map)) {
        const inter = {
          ...component.getInterfaces()[interface_name],
          ...{
            host: `${env_interface}.${this.toExternalHost()}`,
            port: this.gateway_port.toString(),
            protocol: this.toExternalProtocol(),
          },
        };
        inter.url = `${inter.protocol}://${inter.host}:${inter.port}`;
        component.setInterface(interface_name, inter);
      }
    }

    const preset_interfaces: Dictionary<Dictionary<InterfaceSpec>> = {};
    for (const component_config of Object.values(components_map_copy)) {
      const component_interfaces = component_config.getInterfaces();
      for (const [component_interface_name, interface_data] of Object.entries(component_interfaces)) {
        if (!interface_data.host?.startsWith('${{')) {
          const component_ref = `${component_config.getName()}:${component_config.getComponentVersion()}`;
          if (!preset_interfaces[component_ref]) {
            preset_interfaces[component_ref] = {};
          }
          preset_interfaces[component_ref][component_interface_name] = interface_data;
        }
      }
    }

    const ingresses: Dictionary<Dictionary<InterfaceSpec>> = {};
    for (const ingress_edge of graph.edges.filter(edge => edge instanceof IngressEdge)) {
      let edges = [ingress_edge];
      while (edges.length) {
        const current_edge = edges.pop();
        if (current_edge) {
          const node_to = graph.getNodeByRef(current_edge.to);
          if (node_to instanceof InterfacesNode) {
            const parent_component_name = current_edge.from.split(':')[0];
            const component_name = current_edge.to.split(':')[0];
            if (current_edge instanceof IngressEdge) {
              for (const interface_name of Object.values(current_edge.interfaces_map)) {
                if (!ingresses[component_name]) {
                  ingresses[component_name] = {};
                }
                const component_ref = current_edge.to.replace('-interfaces', '');
                ingresses[component_name][interface_name] = preset_interfaces[component_ref][interface_name];
              }
            } else if (current_edge instanceof ServiceEdge) {
              for (const [parent_interface, interface_name] of Object.entries(current_edge.interfaces_map)) {
                if (!ingresses[component_name]) {
                  ingresses[component_name] = {};
                }
                ingresses[component_name][interface_name] = ingresses[parent_component_name][parent_interface];
              }
            }
          }

          if (!(node_to instanceof ServiceNode)) {
            edges = edges.concat(graph.edges.filter(edge => edge.from === node_to.ref));
          }
        }
      }
    }

    return ingresses;
  }

  async getArchitectContext(graph: DependencyGraph, components_map: Dictionary<ComponentConfig>): Promise<any | undefined> {
    return {
      environment: {
        ingresses: this.generateEnvironmentIngresses(graph, components_map),
      },
    };
  }
}
