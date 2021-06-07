import { deserialize, serialize } from 'class-transformer';
import { ValidationError } from 'class-validator';
import { isMatch } from 'matcher';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import GatewayNode from './graph/node/gateway';
import InterfacesNode from './graph/node/interfaces';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { InterfaceSpec } from './spec/common/interface-spec';
import { ComponentConfig } from './spec/component/component-config';
import { Dictionary } from './utils/dictionary';
import { flattenValidationErrors, ValidationErrors } from './utils/errors';
import { interpolateString, replaceBrackets } from './utils/interpolation';
import { ComponentSlugUtils, Slugs } from './utils/slugs';
import { validateInterpolation } from './utils/validation';

interface ComponentConfigNode {
  config: ComponentConfig;
  interpolated_config?: ComponentConfig;
  parents: ComponentConfigNode[];
  children: ComponentConfigNode[];
  level: number;
}

export default abstract class DependencyManager {
  use_sidecar = true;

  getComponentNodes(component: ComponentConfig): DependencyNode[] {
    const nodes = [];
    // Load component services
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const node = new ServiceNode({
        ref: component.getNodeRef(service_name),
        config: service_config,
        local_path: component.getLocalPath(),
        artifact_image: component.getArtifactImage(),
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.getTasks())) {
      const node = new TaskNode({
        ref: component.getNodeRef(task_name),
        config: task_config,
        local_path: component.getLocalPath(),
      });
      nodes.push(node);
    }
    return nodes;
  }

  interpolateInterfaces(initial_component: ComponentConfig) {
    // Interpolate component to fully resolve edges between dependencies/ingress/services
    // Important for host overrides where values might comes from parameters
    const component_string = replaceBrackets(serialize(initial_component));
    const context: any = initial_component.getContext();

    const interpolation_regex = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');
    let matches;

    while ((matches = interpolation_regex.exec(component_string)) != null) {
      const [_, match] = matches;
      const names = match.split('.');

      if (!(match.includes('ingresses.') || match.includes('interfaces.'))) {
        continue;
      }

      let iterations = names.length;
      let c = context;
      for (const name of names) {
        if (!--iterations) {
          c[name] = `@@{{ ${match} }}`;
        } else {
          if (!c[name]) { c[name] = {}; }
          c = c[name];
        }
      }
    }

    const ignore_keys = ['']; // Ignore all errors
    const interpolated_component_string = interpolateString(component_string, context, ignore_keys).replace(/@@{{/g, '${{');
    const component = deserialize(initial_component.getClass(), interpolated_component_string) as ComponentConfig;
    return component;
  }

  addComponentEdges(graph: DependencyGraph, tree_node: ComponentConfigNode, external_addr: string): void {
    const component = this.interpolateInterfaces(tree_node.config);

    const dependency_components = tree_node.children.map(n => n.config);
    const dependency_map: Dictionary<ComponentConfig> = {};
    for (const dependency_component of dependency_components) {
      dependency_map[dependency_component.getRef()] = dependency_component;
    }

    // Add edges FROM services to other services
    for (const [service_name, service_config] of Object.entries({ ...component.getTasks(), ...component.getServices() })) {
      const from = component.getNodeRef(service_name);
      const from_node = graph.getNodeByRef(from);

      const service_string = serialize(service_config);
      let matches;

      // Start Ingress Edges
      const ingresses: [ComponentConfig, string][] = [];
      // Deprecated environment.ingresses
      const environment_ingresses_regex = new RegExp(`\\\${{\\s*environment\\.ingresses\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = environment_ingresses_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        if (dep_name === component.getName()) {
          ingresses.push([component, interface_name]);
        } else {
          const dep_tag = component.getDependencies()[dep_name];
          const dep_component = dependency_map[`${dep_name}:${dep_tag}`];
          ingresses.push([dep_component, interface_name]);
        }
      }
      const dependencies_ingresses_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = dependencies_ingresses_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.getDependencies()[dep_name];
        const dep_component = dependency_map[`${dep_name}:${dep_tag}`];
        ingresses.push([dep_component, interface_name]);
      }
      const ingresses_regex = new RegExp(`\\\${{\\s*ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = ingresses_regex.exec(service_string)) != null) {
        const [_, interface_name] = matches;
        ingresses.push([component, interface_name]);
      }

      for (const [interface_name, interface_obj] of Object.entries(component.getInterfaces())) {
        if (interface_obj.external_name) {
          ingresses.push([component, interface_name]);
        }
      }

      for (const [dep_component, interface_name] of ingresses) {
        if (!dep_component) { continue; }
        const external_name = dep_component.getInterfaces()[interface_name].external_name || dep_component.getNodeRef(interface_name);

        let ingress_edge = graph.edges.find(edge => edge.from === 'gateway' && edge.to === dep_component.getInterfacesRef()) as IngressEdge;
        if (!ingress_edge) {
          const gateway_host = external_addr.split(':')[0];
          const gateway_port = parseInt(external_addr.split(':')[1] || '443');
          const gateway_node = new GatewayNode(gateway_host, gateway_port);
          gateway_node.instance_id = 'gateway';
          graph.addNode(gateway_node);

          ingress_edge = new IngressEdge('gateway', dep_component.getInterfacesRef(), {});
          graph.addEdge(ingress_edge);
        }

        ingress_edge.interfaces_map[external_name] = interface_name;

        if (dep_component.getRef() !== component.getRef()) {
          if (!ingress_edge.consumers_map[external_name]) {
            ingress_edge.consumers_map[external_name] = new Set();
          }
          ingress_edge.consumers_map[external_name].add(from);
        }
      }
      // End Ingress Edges

      if (from_node.is_external) {
        continue;
      }

      // TODO:ingresses only run regex once

      // Add edges between services inside the component and dependencies
      const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const service_edge_map: Dictionary<Dictionary<string>> = {};
      while ((matches = services_regex.exec(service_string)) != null) {
        const [_, service_name, interface_name] = matches;
        const to = component.getNodeRef(service_name);
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

        const dependency = dependency_map[`${dep_name}:${dep_tag}`];
        if (!dependency) continue;
        const to = dependency.getInterfacesRef();

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
      const to = component.getNodeRef(service_name);
      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [component_interface_name, component_interface] of Object.entries(component.getInterfaces())) {
      const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = dependencies_regex.exec(replaceBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, dep_name, interface_name] = matches;
      const dep_tag = component.getDependencies()[dep_name];

      const dependency = dependency_map[`${dep_name}:${dep_tag}`];
      if (!dependency) continue;
      const to = dependency.getInterfacesRef();

      if (!graph.nodes_map.has(to)) continue;

      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interfaces_map);
      graph.addEdge(edge);
    }
  }

  setValuesForComponent(component: ComponentConfig, all_values: Dictionary<Dictionary<string | null>>) {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(all_values).sort();
    const sorted_values_dict: Dictionary<Dictionary<string | null>> = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = all_values[key];
    }

    const component_ref = component.getRef();
    const component_parameters = component.getParameters();
    // add values from values file to all existing, matching components
    for (const [pattern, params] of Object.entries(sorted_values_dict)) {
      const component_has_tag = component_ref.includes(':');
      if (isMatch(component_has_tag ? component_ref : `${component_ref}:latest`, [pattern])) {
        for (const [param_key, param_value] of Object.entries(params)) {
          if (component_parameters[param_key]) {
            component_parameters[param_key].default = param_value;
            component.setParameter(param_key, component_parameters[param_key]);
          }
        }
      }
    }
  }

  generateUrl(interface_config: InterfaceSpec, host?: string, port?: string) {
    host = host || interface_config.host;
    port = port || interface_config.port;
    const protocol = interface_config.protocol || 'http';
    let url;
    if (interface_config.username && interface_config.password) {
      url = `${protocol}://${interface_config.username}:${interface_config.password}@${host}`;
    } else {
      url = `${protocol}://${host}`;
    }
    if (port !== '80' && port !== '443') {
      url = `${url}:${port}`;
    }
    return url;
  }

  getIngressesContext(graph: DependencyGraph, edge: IngressEdge, interface_from: string, external_address: string, dependency?: ComponentConfig): InterfaceSpec {
    const interface_to = edge.interfaces_map[interface_from];

    let external_interface: InterfaceSpec;

    const [node_to, node_to_interface_name] = graph.followEdge(edge, interface_from);

    const dependency_interface = node_to.interfaces[node_to_interface_name];
    // Special case for external nodes
    if (dependency_interface.host && dependency_interface.host !== '127.0.0.1') {
      let subdomain = dependency_interface.host.split('.')[0];

      // Don't set subdomain if the host doesn't have one
      if (dependency_interface.host === subdomain) {
        subdomain = '';
      }

      external_interface = {
        ...(dependency ? dependency.getInterfaces()[interface_to] : {}),
        ...dependency_interface,
        consumers: [],
        subdomain: subdomain,
        dns_zone: dependency_interface.host.split('.').slice(1).join('.') || dependency_interface.host,
      };
    } else {
      const [external_host, external_port] = external_address.split(':');
      external_interface = {
        host: `${interface_from}.${external_host}`,
        port: external_port,
        protocol: external_host.endsWith('localhost') ? 'http' : 'https',
        username: '',
        password: '',
        subdomain: interface_from,
        dns_zone: external_host,
      };
    }
    external_interface.username = '';
    external_interface.password = '';
    external_interface.url = this.generateUrl(external_interface);
    return external_interface;
  }

  async interpolateComponent(graph: DependencyGraph, initial_component: ComponentConfig, external_address: string, dependencies: ComponentConfig[]) {
    const component = initial_component;
    const component_string = replaceBrackets(serialize(component.expand()));

    let proxy_port = 12345;
    const proxy_port_mapping: Dictionary<string> = {};

    const context = component.getContext();

    context.environment = {
      ingresses: {},
    };

    const not_found = {
      host: 'not-found.localhost',
      port: '404',
      protocol: 'http',
      url: 'http://not-found.localhost:404',
      username: '',
      password: '',
    };
    const interpolation_regex = new RegExp(`\\\${{\\s*(dependencies\\..*?)\\s*}}`, 'g');
    let matches;
    // Set not-found for dependencies
    while ((matches = interpolation_regex.exec(component_string)) != null) {
      const [_, match] = matches;
      const names = match.split('.');

      const dep_name = names[1];
      if (!component.getDependencies()[dep_name]) {
        continue;
      }

      let iterations = names.length - 1;
      let c = context;
      for (const name of names) {
        if (!--iterations) {
          c[name] = not_found;
          break;
        } else {
          if (!c[name]) { c[name] = {}; }
          c = c[name];
        }
      }
    }

    for (const dependency of dependencies) {
      context.dependencies[dependency.getName()].interfaces = {};
      // Set dependency interfaces
      for (const [interface_name, interface_config] of Object.entries(dependency.getInterfaces())) {
        context.dependencies[dependency.getName()].interfaces[interface_name] = interface_config;
        if (this.use_sidecar && interface_config.host === '127.0.0.1') {
          const sidecar_service = `${dependency.getInterfacesRef()}--${interface_name}`;

          if (!proxy_port_mapping[sidecar_service]) {
            proxy_port_mapping[sidecar_service] = `${proxy_port}`;
            proxy_port += 1;
          }

          context.dependencies[dependency.getName()].interfaces[interface_name] = {
            ...context.dependencies[dependency.getName()].interfaces[interface_name],
            host: '127.0.0.1',
            port: proxy_port_mapping[sidecar_service],
            url: this.generateUrl(interface_config, '127.0.0.1', proxy_port_mapping[sidecar_service]),
          };
        }
      }
    }

    for (const dependency of [component, ...dependencies]) {
      // Set dependency and component ingresses
      const ingress_edges = graph.edges.filter(edge => edge.from === 'gateway' && edge.to === dependency.getInterfacesRef()) as IngressEdge[];
      for (const ingress_edge of ingress_edges) {
        for (const [interface_from, interface_to] of Object.entries(ingress_edge.interfaces_map)) {
          const external_interface = this.getIngressesContext(graph, ingress_edge, interface_from, external_address, dependency);

          if (!context.environment.ingresses[dependency.getName()]) {
            context.environment.ingresses[dependency.getName()] = {};
          }
          context.environment.ingresses[dependency.getName()][interface_to] = external_interface; // Deprecated environment.ingresses

          if (dependency.getRef() === component.getRef()) {
            context.ingresses[interface_to] = external_interface;
            context.ingresses[interface_to].consumers = [];

            if (ingress_edge.consumers_map[interface_from]) {
              const interfaces_refs = graph.edges.filter(edge => ingress_edge.consumers_map[interface_from].has(edge.to) && graph.getNodeByRef(edge.from) instanceof InterfacesNode).map(edge => edge.from);
              const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && interfaces_refs.includes(edge.to)) as IngressEdge[];
              const consumers = [];
              for (const consumer_ingress_edge of consumer_ingress_edges) {
                for (const consumer_interface_from of Object.keys(consumer_ingress_edge.interfaces_map)) {
                  const consumer_interface = this.getIngressesContext(graph, consumer_ingress_edge, consumer_interface_from, external_address);
                  consumers.push(consumer_interface.url);
                }
              }
              context.ingresses[interface_to].consumers = consumers.sort();
            }
          } else {
            context.dependencies[dependency.getName()].ingresses[interface_to] = external_interface;
          }
        }
      }
    }

    // Set service interfaces
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const service_ref = component.getNodeRef(service_name);
      const service_node = graph.getNodeByRef(service_ref);
      for (const [interface_name, interface_config] of Object.entries(service_config.getInterfaces())) {
        let internal_host;
        let internal_port;
        if (service_node.is_external) {
          internal_host = interface_config.host;
          internal_port = interface_config.port;
        } else {
          if (this.use_sidecar) {
            const sidecar_service = `${service_ref}--${interface_name}`;
            if (!proxy_port_mapping[sidecar_service]) {
              proxy_port_mapping[sidecar_service] = `${proxy_port}`;
              proxy_port += 1;
            }
            internal_host = '127.0.0.1';
            internal_port = proxy_port_mapping[sidecar_service];
          } else {
            internal_host = service_ref;
            internal_port = interface_config.port;
          }
        }

        const internal_protocol = interface_config.protocol || 'http';
        const internal_url = this.generateUrl(interface_config, internal_host, internal_port);

        context.services[service_name].interfaces[interface_name] = {
          ...context.services[service_name].interfaces[interface_name],
          host: internal_host,
          port: internal_port,
          protocol: internal_protocol,
          url: internal_url,
        };
      }
    }

    const ignore_keys: string[] = [];

    const errors = await this.validateComponent(component, context, ignore_keys);
    if (errors.length) {
      throw new ValidationErrors(component.getRef(), flattenValidationErrors(errors));
    }

    const interpolated_component_string = interpolateString(component_string, context, ignore_keys);
    const interpolated_component_config = deserialize(component.getClass(), interpolated_component_string) as ComponentConfig;

    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    interpolated_component_config.proxy_port_mapping = proxy_port_mapping;
    return interpolated_component_config;
  }

  findClosestComponent(component_configs: ComponentConfig[], date: Date): ComponentConfig | undefined {
    if (component_configs.length === 0) { return; }
    if (component_configs.length === 1) { return component_configs[0]; }

    const target_time = date.getTime();

    let res = undefined;
    let best_diff = Number.NEGATIVE_INFINITY;
    for (const component_config of component_configs) {
      const current_time = component_config.getInstanceDate().getTime();
      const current_diff = current_time - target_time;
      if (current_diff <= 0 && current_diff > best_diff) {
        best_diff = current_diff;
        res = component_config;
      }
    }
    return res;
  }

  getDependencyComponents(component_config: ComponentConfig, component_configs: ComponentConfig[]) {
    const component_map: Dictionary<ComponentConfig[]> = {};
    for (const component_config of component_configs) {
      if (!component_map[component_config.getRef()]) {
        component_map[component_config.getRef()] = [];
      }
      // Potentially multiple components with the same ref and different instance ids
      component_map[component_config.getRef()].push(component_config);
    }

    const dependency_components = [];
    for (const [dep_name, dep_tag] of Object.entries(component_config.getDependencies())) {
      const dep_ref = `${dep_name}:${dep_tag}`;
      if (!component_map[dep_ref]) {
        continue;
      }
      const dep_components = component_map[dep_ref];
      const dep_component = this.findClosestComponent(dep_components, component_config.getInstanceDate());
      if (!dep_component) {
        continue;
      }
      dependency_components.push(dep_component);
    }
    return dependency_components;
  }

  async validateComponent(component: ComponentConfig, context: object, ignore_keys: string[] = [], groups = ['developer', 'register']): Promise<ValidationError[]> {
    let validation_errors = [];
    // Check required parameters for components
    for (const [pk, pv] of Object.entries(component.getParameters())) {
      if (pv.required !== 'false' && (pv.default === undefined)) {
        const validation_error = new ValidationError();
        validation_error.property = `components.${component.getName()}.parameters.${pk}`;
        validation_error.target = pv;
        validation_error.value = pv.default;
        validation_error.constraints = { Required: `${pk} is required` };
        validation_error.children = [];
        validation_errors.push(validation_error);
      }
    }
    try {
      await component.validateOrReject({ groups });
    } catch (err) {
      if (err instanceof Array) {
        validation_errors = [...validation_errors, ...err];
      } else {
        throw err;
      }
    }
    return [...validation_errors, ...validateInterpolation(serialize(component), context, ignore_keys)];
  }

  async _getGraph(tree_nodes: ComponentConfigNode[], external_addr: string) {
    const graph = new DependencyGraph();

    if (tree_nodes.length === 0) {
      return graph;
    }

    // Add nodes
    for (const tree_node of tree_nodes) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const component_config = tree_node.config;

      const context = component_config.getContext();
      const component_string = serialize(component_config);
      const ignore_keys = [''];
      const interpolated_component_string = interpolateString(component_string, context, ignore_keys);
      const interpolated_component_config = deserialize(component_config.getClass(), interpolated_component_string) as ComponentConfig;

      let nodes: DependencyNode[] = [];

      nodes = nodes.concat(this.getComponentNodes(interpolated_component_config));

      if (Object.keys(component_config.getInterfaces()).length) {
        const node = new InterfacesNode(component_config.getInterfacesRef(), component_config.getRef());
        nodes.push(node);
      }

      for (const node of nodes) {
        node.instance_id = component_config.getInstanceId();
        graph.addNode(node);
      }
    }

    // Add edges
    for (const tree_node of tree_nodes) {
      this.addComponentEdges(graph, tree_node, external_addr);
    }

    for (const edge of graph.edges) {
      const from_node = graph.getNodeByRef(edge.from);
      if (from_node instanceof GatewayNode) {
        const to_node = graph.getNodeByRef(edge.to);
        edge.instance_id = to_node.instance_id;
      } else {
        edge.instance_id = from_node.instance_id;
      }
    }

    return graph;
  }

  createComponentTree(component_configs: ComponentConfig[]) {
    const nodes: Dictionary<ComponentConfigNode> = {};
    // Initialize nodes
    for (const component_config of component_configs) {
      nodes[component_config.getRef()] = {
        config: component_config,
        parents: [],
        children: [],
        level: 0,
      };
    }

    // Set parents/children
    for (const component_config of component_configs) {
      const node = nodes[component_config.getRef()];
      const dependency_components = this.getDependencyComponents(component_config, component_configs);
      for (const dependency_component of dependency_components) {
        const child_node = nodes[dependency_component.getRef()];
        node.children.push(child_node);
        child_node.parents.push(node);
      }
    }

    const root_level = Math.min(...Object.values(nodes).map(n => n.level));

    // Set node levels
    const root_nodes = Object.values(nodes).filter(node => node.level === root_level);
    for (const root_node of root_nodes) {
      const stack = [{ node: root_node, seen_nodes: [] as string[] }];
      while (stack.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        const { node, seen_nodes } = stack.pop()!;

        if (seen_nodes.includes(node.config.getRef())) {
          throw new Error(`Circular component dependency detected (${seen_nodes.join(' <> ')})`);
        }

        for (const child_node of node.children) {
          child_node.level = Math.max(child_node.level, node.level + 1);
          stack.push({ node: child_node, seen_nodes: [node.config.getRef(), ...seen_nodes] });
        }
      }
    }

    // Sort so leaves are first and roots are last
    const sorted_nodes = Object.values(nodes).sort((a, b) => (a.level < b.level) ? 1 : -1);
    return sorted_nodes;
  }

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string | null>> = {}, external_addr: string) {
    const tree_nodes = this.createComponentTree(component_configs);

    // Set parameters from secrets
    for (const tree_node of tree_nodes) {
      this.setValuesForComponent(tree_node.config, values);
    }

    const graph = await this._getGraph(tree_nodes, external_addr);

    // Interpolate after graph creation for ingress.consumers
    for (const tree_node of tree_nodes) {
      const dependencies = [];
      for (const child_node of tree_node.children) {
        if (!child_node.interpolated_config) {
          throw new Error('Child node not interpolated');
        }
        dependencies.push(child_node.interpolated_config);
      }
      tree_node.interpolated_config = await this.interpolateComponent(graph, tree_node.config, external_addr, dependencies);

      for (const [service_name, service_config] of [...Object.entries(tree_node.interpolated_config.getServices()), ...Object.entries(tree_node.interpolated_config.getTasks())]) {
        const service_ref = tree_node.interpolated_config.getNodeRef(service_name);
        const node = graph.getNodeByRef(service_ref) as ServiceNode | TaskNode;
        // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
        // @ts-ignore
        node.proxy_port_mapping = tree_node.interpolated_config.proxy_port_mapping;
        node.config = service_config;
      }
    }
    return graph;
  }
}
