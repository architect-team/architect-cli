import { serialize } from 'class-transformer';
import { isMatch } from 'matcher';
import { buildComponentRef, buildInterfacesRef, buildNodeRef, ComponentConfig, ComponentInterfaceConfig } from './config/component-config';
import { ComponentContext } from './config/component-context';
import { ServiceInterfaceConfig } from './config/service-config';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import GatewayNode from './graph/node/gateway';
import InterfacesNode from './graph/node/interfaces';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentContext, transformComponentSpec } from './spec/transform/component-transform';
import { parseSourceYml } from './spec/utils/component-builder';
import { interpolateConfigOrReject } from './spec/utils/component-interpolation';
import { ComponentSlugUtils, Slugs } from './spec/utils/slugs';
import { Dictionary } from './utils/dictionary';
import { ArchitectError, ValidationError, ValidationErrors } from './utils/errors';
import { interpolateStringOrReject, replaceInterpolationBrackets } from './utils/interpolation';
import { ValuesConfig } from './values/values';

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
    for (const [service_name, service_config] of Object.entries(component.services)) {
      const node = new ServiceNode({
        ref: buildNodeRef(component, service_name),
        config: service_config,
        local_path: component.instance_metadata?.local_path,
        artifact_image: component.artifact_image,
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.tasks)) {
      const node = new TaskNode({
        ref: buildNodeRef(component, task_name),
        config: task_config,
        local_path: component.instance_metadata?.local_path,
      });
      nodes.push(node);
    }
    return nodes;
  }

  interpolateInterfaces(initial_component: ComponentConfig): ComponentConfig {
    // Interpolate component to fully resolve edges between dependencies/ingress/services
    // Important for host overrides where values might comes from parameters
    initial_component.source_yml = replaceInterpolationBrackets(initial_component.source_yml);
    const context: ComponentContext = JSON.parse(JSON.stringify(initial_component.context));

    const interpolation_regex = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');
    let matches;

    while ((matches = interpolation_regex.exec(initial_component.source_yml)) != null) {
      const [_, match] = matches;
      const names = match.split('.');

      if (!(match.includes('ingresses.') || match.includes('interfaces.'))) {
        continue;
      }

      // without partially interpolating we don't know to draw an edge between the api/worker
      let iterations = names.length;
      let c = context;
      for (const name of names) {
        if (!--iterations) {
          c[name] = `__arc__{{ ${match} }}`;
        } else {
          if (!c[name]) { c[name] = {}; }
          c = c[name];
        }
      }
    }

    const ignore_keys = ['']; // Ignore all errors

    const interpolated_component_string = interpolateStringOrReject(initial_component.source_yml, context, ignore_keys).replace(/__arc__{{/g, '${{');
    const parsed_yml = parseSourceYml(interpolated_component_string);
    const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, interpolated_component_string, initial_component.tag, initial_component.instance_metadata);
    return interpolated_component_config;
  }

  addComponentEdges(graph: DependencyGraph, tree_node: ComponentConfigNode, external_addr: string): void {
    const component = this.interpolateInterfaces(tree_node.config);

    const dependency_components = tree_node.children.map(n => n.config);
    const dependency_map: Dictionary<ComponentConfig> = {};
    for (const dependency_component of dependency_components) {
      const dependency_ref = buildComponentRef(dependency_component);
      dependency_map[dependency_ref] = dependency_component;
    }

    // Add edges FROM services to other services
    for (const [service_name, service_config] of Object.entries({ ...component.tasks, ...component.services })) {
      const from = buildNodeRef(component, service_name);
      const from_node = graph.getNodeByRef(from);

      const service_string = serialize(service_config);
      let matches;

      // Start Ingress Edges
      const ingresses: [ComponentConfig, string][] = [];
      // Deprecated environment.ingresses
      const environment_ingresses_regex = new RegExp(`\\\${{\\s*environment\\.ingresses\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = environment_ingresses_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        if (dep_name === component.name) {
          ingresses.push([component, interface_name]);
        } else {
          const dep_tag = component.dependencies[dep_name];
          const dep_component = dependency_map[`${dep_name}:${dep_tag}`];
          ingresses.push([dep_component, interface_name]);
        }
      }
      const dependencies_ingresses_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = dependencies_ingresses_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.dependencies[dep_name];
        const dep_component = dependency_map[`${dep_name}:${dep_tag}`];
        ingresses.push([dep_component, interface_name]);
      }
      const ingresses_regex = new RegExp(`\\\${{\\s*ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      while ((matches = ingresses_regex.exec(service_string)) != null) {
        const [_, interface_name] = matches;
        ingresses.push([component, interface_name]);
      }
      for (const [interface_name, interface_obj] of Object.entries(component.interfaces)) {
        if (interface_obj?.ingress?.subdomain && interface_obj.ingress?.enabled) {
          ingresses.push([component, interface_name]);
        }
      }

      for (const [dep_component, interface_name] of ingresses) {
        if (!dep_component) { continue; }
        if (!dep_component.interfaces[interface_name]) { continue; }
        let subdomain = dep_component.interfaces[interface_name].ingress?.subdomain || interface_name;
        try {
          subdomain = interpolateStringOrReject(subdomain, dep_component.context);
          // eslint-disable-next-line no-empty
        } catch { }

        let ingress_edge = graph.edges.find(edge => edge.from === 'gateway' && edge.to === buildInterfacesRef(dep_component)) as IngressEdge;
        if (!ingress_edge) {
          const gateway_host = external_addr.split(':')[0];
          const gateway_port = parseInt(external_addr.split(':')[1] || '443');
          const gateway_node = new GatewayNode(gateway_host, gateway_port);
          gateway_node.instance_id = 'gateway';
          graph.addNode(gateway_node);

          ingress_edge = new IngressEdge('gateway', buildInterfacesRef(dep_component), {});
          graph.addEdge(ingress_edge);
        }

        ingress_edge.interfaces_map[subdomain] = interface_name;

        if (buildComponentRef(dep_component) !== buildComponentRef(component)) {
          if (!ingress_edge.consumers_map[subdomain]) {
            ingress_edge.consumers_map[subdomain] = new Set();
          }
          ingress_edge.consumers_map[subdomain].add(from);
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
        const to = buildNodeRef(component, service_name);
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
        const dep_tag = component.dependencies[dep_name];

        const dependency = dependency_map[`${dep_name}:${dep_tag}`];
        if (!dependency) continue;
        const to = buildInterfacesRef(dependency);

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
    for (const [component_interface_name, component_interface] of Object.entries(component.interfaces)) {
      if (!component_interface) { continue; }
      const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = services_regex.exec(replaceInterpolationBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, service_name, interface_name] = matches;
      const to = buildNodeRef(component, service_name);
      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [component_interface_name, component_interface] of Object.entries(component.interfaces)) {
      if (!component_interface) { continue; }
      const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const matches = dependencies_regex.exec(replaceInterpolationBrackets(component_interface.url!));
      if (!matches) continue;

      const [_, dep_name, interface_name] = matches;
      const dep_tag = component.dependencies[dep_name];

      const dependency = dependency_map[`${dep_name}:${dep_tag}`];
      if (!dependency) continue;
      const to = buildInterfacesRef(dependency);

      if (!graph.nodes_map.has(to)) continue;

      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      if (!graph.nodes_map.has(to)) continue;
      const edge = new ServiceEdge(buildInterfacesRef(component), to, interfaces_map);
      graph.addEdge(edge);
    }
  }

  setValuesForComponent(component: ComponentConfig, all_values: Dictionary<Dictionary<string | null>>): void {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(all_values).sort();
    const sorted_values_dict: Dictionary<Dictionary<string | null>> = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = all_values[key];
    }

    const component_ref = buildComponentRef(component);
    const component_parameters = component.parameters;
    // add values from values file to all existing, matching components
    for (const [pattern, params] of Object.entries(sorted_values_dict)) {
      const component_has_tag = component_ref.includes(':');
      if (isMatch(component_has_tag ? component_ref : `${component_ref}:latest`, [pattern])) {
        for (const [param_key, param_value] of Object.entries(params)) {
          if (component_parameters[param_key]) {
            component_parameters[param_key].default = param_value;
            component.parameters[param_key] = component_parameters[param_key];
          }
        }
      }
    }
  }

  generateAddress(host: string, port: string): string {
    if (port !== '80' && port !== '443') {
      host = `${host}:${port}`;
    }
    return host;
  }

  generateUrl(interface_config: ServiceInterfaceConfig, host?: string | null, port?: string): string {
    host = host || interface_config.host || undefined;
    port = port || `${interface_config.port}`;
    const protocol = interface_config.protocol || 'http';
    let url;
    if (interface_config.password) {
      url = `${protocol}://${interface_config.username || ''}:${interface_config.password}@${host}`;
    } else {
      url = `${protocol}://${host}`;
    }
    url = this.generateAddress(url, port);
    return url;
  }

  getIngressesContext(graph: DependencyGraph, edge: IngressEdge, interface_from: string, external_address: string, dependency?: ComponentConfig): ComponentInterfaceConfig | undefined {
    const interface_to = edge.interfaces_map[interface_from];

    let partial_external_interface: Partial<ComponentInterfaceConfig>;

    const [node_to, node_to_interface_name] = graph.followEdge(edge, interface_from);

    const dependency_interface = node_to.interfaces[node_to_interface_name];

    if (!dependency_interface) {
      return;
    }

    // Special case for external nodes
    if (dependency_interface.host && dependency_interface.host !== '127.0.0.1') {
      let subdomain = dependency_interface.host.split('.')[0];

      // Don't set subdomain if the host doesn't have one
      if (dependency_interface.host === subdomain) {
        subdomain = '';
      }

      partial_external_interface = {
        ...(dependency ? dependency.interfaces[interface_to] : {}),
        ...dependency_interface,
        consumers: [],
        subdomain,
        dns_zone: dependency_interface.host.split('.').slice(1).join('.'),
      };
    } else {
      const [external_host, external_port] = external_address.split(':');

      const host = interface_from === '@' ? external_host : `${interface_from}.${external_host}`;
      partial_external_interface = {
        host,
        port: external_port,
        protocol: external_host === 'arc.localhost' ? 'http' : 'https',
        username: '',
        password: '',
        subdomain: interface_from,
        dns_zone: external_host,
      };
    }
    const external_interface = {
      ...partial_external_interface,
      username: '',
      password: '',
      url: this.generateUrl(partial_external_interface),
    };
    return external_interface;
  }

  async interpolateComponent(graph: DependencyGraph, initial_component: ComponentConfig, external_address: string, dependencies: ComponentConfig[], validate = true): Promise<ComponentConfig> {
    const component_string = replaceInterpolationBrackets(initial_component.source_yml);

    let proxy_port = 12345;
    const proxy_port_mapping: Dictionary<string> = {};

    const context = initial_component.context;

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
      if (!initial_component.dependencies[dep_name]) {
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
      context.dependencies[dependency.name].outputs = dependency.context.outputs;
      context.dependencies[dependency.name].interfaces = dependency.context.interfaces;
      context.dependencies[dependency.name].ingresses = dependency.context.ingresses;
      // Set dependency interfaces
      for (const [interface_name, interface_config] of Object.entries(dependency.context.interfaces)) {
        if (this.use_sidecar && interface_config.host === '127.0.0.1') {
          const sidecar_service = `${buildInterfacesRef(dependency)}--${interface_name}`;

          if (!proxy_port_mapping[sidecar_service]) {
            proxy_port_mapping[sidecar_service] = `${proxy_port}`;
            proxy_port += 1;
          }

          context.dependencies[dependency.name].interfaces[interface_name] = {
            ...context.dependencies[dependency.name].interfaces[interface_name],
            host: '127.0.0.1',
            port: proxy_port_mapping[sidecar_service],
            url: this.generateUrl(interface_config, '127.0.0.1', proxy_port_mapping[sidecar_service]),
          };
        }
      }
    }

    for (const dependency of [initial_component, ...dependencies]) {
      // Set dependency and component ingresses
      const ingress_edges = graph.edges.filter(edge => edge.from === 'gateway' && edge.to === buildInterfacesRef(dependency)) as IngressEdge[];
      for (const ingress_edge of ingress_edges) {
        for (const [interface_from, interface_to] of Object.entries(ingress_edge.interfaces_map)) {
          const external_interface = this.getIngressesContext(graph, ingress_edge, interface_from, external_address, dependency);

          if (!external_interface) {
            continue;
          }

          if (!context.environment.ingresses[dependency.name]) {
            context.environment.ingresses[dependency.name] = {};
          }
          context.environment.ingresses[dependency.name][interface_to] = external_interface; // Deprecated environment.ingresses

          if (buildComponentRef(dependency) === buildComponentRef(initial_component)) {
            context.ingresses[interface_to] = external_interface;
            context.ingresses[interface_to].consumers = [];

            if (ingress_edge.consumers_map[interface_from]) {
              const interfaces_refs = graph.edges.filter(edge => ingress_edge.consumers_map[interface_from].has(edge.to) && graph.getNodeByRef(edge.from) instanceof InterfacesNode).map(edge => edge.from);
              const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && interfaces_refs.includes(edge.to)) as IngressEdge[];
              const consumers: string[] = [];
              for (const consumer_ingress_edge of consumer_ingress_edges) {
                for (const consumer_interface_from of Object.keys(consumer_ingress_edge.interfaces_map)) {
                  const consumer_interface = this.getIngressesContext(graph, consumer_ingress_edge, consumer_interface_from, external_address);
                  if (consumer_interface?.url) {
                    consumers.push(consumer_interface.url);
                  }
                }
              }
              context.ingresses[interface_to].consumers = consumers.sort();
            }
          } else {
            context.dependencies[dependency.name].ingresses[interface_to] = external_interface;
          }
        }
      }
    }

    // Set service interfaces
    for (const [service_name, service_config] of Object.entries(initial_component.services)) {
      const service_ref = buildNodeRef(initial_component, service_name);
      const service_node = graph.getNodeByRef(service_ref);
      for (const [interface_name, interface_config] of Object.entries(service_config.interfaces)) {
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
        const internal_url = this.generateUrl(interface_config, internal_host, `${internal_port}`);

        context.services[service_name].interfaces[interface_name] = {
          ...context.services[service_name].interfaces[interface_name],
          host: internal_host,
          port: internal_port,
          protocol: internal_protocol,
          url: internal_url,
        };
      }
    }

    // Set component interfaces
    for (const [interface_name, interface_config] of Object.entries(initial_component.interfaces)) {
      const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
      const matches = url_regex.exec(interface_config.url);
      if (matches) {
        context.interfaces[interface_name] = {
          host: interface_config.host || `\${{ ${matches[1]}.host }}`,
          port: interface_config.port || `\${{ ${matches[1]}.port }}`,
          username: interface_config.username || `\${{ ${matches[1]}.username }}`,
          password: interface_config.password || `\${{ ${matches[1]}.password }}`,
          protocol: interface_config.protocol || `\${{ ${matches[1]}.protocol }}`,
          url: interface_config.url || `\${{ ${matches[1]}.url }}`,
        };
      }
    }

    const ignore_keys: string[] = [];
    const interpolated_config = interpolateConfigOrReject(initial_component, ignore_keys, validate);

    interpolated_config.proxy_port_mapping = proxy_port_mapping;
    return interpolated_config;
  }

  findClosestComponent(component_configs: ComponentConfig[], date: Date): ComponentConfig | undefined {
    if (component_configs.length === 0) { return; }
    if (component_configs.length === 1) { return component_configs[0]; }

    const target_time = date.getTime();

    let res = undefined;
    let best_diff = Number.NEGATIVE_INFINITY;
    for (const component_config of component_configs) {
      if (!component_config.instance_metadata) {
        throw new Error(`Instance metadata has not been set on component: ${component_config.name}`);
      }
      const current_time = component_config.instance_metadata?.instance_date.getTime();
      const current_diff = current_time - target_time;
      if (current_diff <= 0 && current_diff > best_diff) {
        best_diff = current_diff;
        res = component_config;
      }
    }
    return res;
  }

  getDependencyComponents(component_config: ComponentConfig, component_configs: ComponentConfig[]): ComponentConfig[] {
    const component_map: Dictionary<ComponentConfig[]> = {};
    for (const component_config of component_configs) {
      const ref = buildComponentRef(component_config);
      if (!component_map[ref]) {
        component_map[ref] = [];
      }
      // Potentially multiple components with the same ref and different instance ids
      component_map[ref].push(component_config);
    }

    const dependency_components = [];
    for (const [dep_name, dep_tag] of Object.entries(component_config.dependencies)) {
      const dep_ref = `${dep_name}:${dep_tag}`;
      if (!component_map[dep_ref]) {
        continue;
      }
      const dep_components = component_map[dep_ref];
      if (!component_config.instance_metadata) {
        throw new Error(`Instance metadata has not been set on component: ${component_config.name}`);
      }
      const dep_component = this.findClosestComponent(dep_components, component_config.instance_metadata?.instance_date);
      if (!dep_component) {
        continue;
      }
      dependency_components.push(dep_component);
    }
    return dependency_components;
  }

  validateComponent(component: ComponentConfig): void {
    const validation_errors = [];
    // Check required parameters for components
    for (const [pk, pv] of Object.entries(component.parameters)) {
      if (pv.required !== false && (pv.default === undefined)) {
        const validation_error = new ValidationError({
          component: component.name,
          path: `parameters.${pk}`,
          message: `${pk} is a required parameter`,
          value: pv.default,
        });
        validation_errors.push(validation_error);
      }
    }
    if (validation_errors.length) {
      throw new ValidationErrors(validation_errors, component.file);
    }
  }

  protected async _getGraph(tree_nodes: ComponentConfigNode[], external_addr: string): Promise<DependencyGraph> {
    const graph = new DependencyGraph();

    if (tree_nodes.length === 0) {
      return graph;
    }

    // Add nodes
    for (const tree_node of tree_nodes) {
      const component_config = tree_node.config;

      let nodes: DependencyNode[] = [];

      // Interpolate to determine if there are external nodes
      // ex. host: ${{ parameter.optional_host }}
      const interpolated_config = interpolateConfigOrReject(component_config, [''], false);
      nodes = nodes.concat(this.getComponentNodes(interpolated_config));

      if (Object.keys(component_config.interfaces).length) {
        const ref = buildComponentRef(component_config);
        const node = new InterfacesNode(buildInterfacesRef(component_config), ref, interpolated_config.interfaces);
        nodes.push(node);
      }

      for (const node of nodes) {
        node.instance_id = component_config.instance_metadata?.instance_id || '';
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

  createComponentTree(component_configs: ComponentConfig[]): ComponentConfigNode[] {
    const nodes: Dictionary<ComponentConfigNode> = {};
    // Initialize nodes
    for (const component_config of component_configs) {
      const ref = buildComponentRef(component_config);
      nodes[ref] = {
        config: component_config,
        parents: [],
        children: [],
        level: 0,
      };
    }

    // Set parents/children
    for (const component_config of component_configs) {
      const ref = buildComponentRef(component_config);
      const node = nodes[ref];
      const dependency_components = this.getDependencyComponents(component_config, component_configs);
      for (const dependency_component of dependency_components) {
        const dependency_ref = buildComponentRef(dependency_component);
        const child_node = nodes[dependency_ref];
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

        const ref = buildComponentRef(node.config);
        if (seen_nodes.includes(ref)) {
          throw new ArchitectError(`Circular component dependency detected (${seen_nodes.join(' <> ')})`);
        }

        for (const child_node of node.children) {
          child_node.level = Math.max(child_node.level, node.level + 1);
          stack.push({ node: child_node, seen_nodes: [ref, ...seen_nodes] });
        }
      }
    }

    // Sort so leaves are first and roots are last
    const sorted_nodes = Object.values(nodes).sort((a, b) => (a.level < b.level) ? 1 : -1);
    return sorted_nodes;
  }

  validateGraph(graph: DependencyGraph): void {
    // Check for duplicate subdomains
    const seen_subdomains: Dictionary<string[]> = {};
    for (const ingress_edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      for (const [interface_from, interface_to] of Object.entries(ingress_edge.interfaces_map)) {
        if (!seen_subdomains[interface_from]) {
          seen_subdomains[interface_from] = [];
        }
        const node = graph.getNodeByRef(ingress_edge.to) as InterfacesNode;
        seen_subdomains[interface_from].push(`${node.slug}.${interface_to}`);
      }
    }

    for (const [subdomain, values] of Object.entries(seen_subdomains)) {
      if (values.length > 1) {
        throw new ArchitectError(`The subdomain '${subdomain}' is claimed by multiple component interfaces:\n[${values.sort().join(', ')}]\nPlease set interfaces.<name>.ingress.subdomain=<subdomain> to avoid conflicts.`);
      }
    }
  }

  async getGraph(component_configs: ComponentConfig[], values: Dictionary<Dictionary<string | null>> = {}, interpolate = true, validate = true, external_addr: string): Promise<DependencyGraph> {
    ValuesConfig.validate(values);

    const tree_nodes = this.createComponentTree(component_configs);

    // Set parameters from secrets
    for (const tree_node of tree_nodes) {
      this.setValuesForComponent(tree_node.config, values);
      tree_node.config.context = transformComponentContext(tree_node.config);

      if (interpolate && validate) {
        this.validateComponent(tree_node.config);
      }
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

      if (interpolate) {
        tree_node.interpolated_config = await this.interpolateComponent(graph, tree_node.config, external_addr, dependencies, validate);
      } else {
        tree_node.interpolated_config = tree_node.config;
      }

      if (Object.keys(tree_node.interpolated_config.interfaces).length) {
        const interfaces_node = graph.getNodeByRef(buildInterfacesRef(tree_node.interpolated_config)) as InterfacesNode;
        interfaces_node.config = tree_node.interpolated_config.interfaces;
      }

      for (const [service_name, service_config] of [...Object.entries(tree_node.interpolated_config.services), ...Object.entries(tree_node.interpolated_config.tasks)]) {
        const service_ref = buildNodeRef(tree_node.interpolated_config, service_name);
        const node = graph.getNodeByRef(service_ref) as ServiceNode | TaskNode;
        node.proxy_port_mapping = tree_node.interpolated_config.proxy_port_mapping;
        node.config = service_config;
      }
    }
    return graph;
  }
}
