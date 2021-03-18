import { deserialize, serialize } from 'class-transformer';
import { isMatch } from 'matcher';
import { ComponentConfig, ComponentSlugUtils, DependencyNode, InterfaceSlugUtils, InterfaceSpec, ServiceNode, Slugs, TaskNode } from '.';
import DependencyGraph from './graph';
import DependencyEdge from './graph/edge';
import ServiceEdge from './graph/edge/service';
import { Dictionary } from './utils/dictionary';
import { interpolateString, replaceBrackets } from './utils/interpolation';

export default abstract class DependencyManager {
  static getComponentNodes(component: ComponentConfig, instance_id: string): DependencyNode[] {
    const nodes = [];
    // Load component services
    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const node = new ServiceNode({
        ref: component.getServiceRef(service_name, instance_id),
        node_config: service_config,
        local_path: component.getLocalPath(),
        artifact_image: component.getArtifactImage(),
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.getTasks())) {
      const node = new TaskNode({
        ref: component.getServiceRef(task_name, instance_id),
        node_config: task_config,
        local_path: component.getLocalPath(),
      });
      nodes.push(node);
    }
    return nodes;
  }

  static interpolateInterfaces(initial_component: ComponentConfig, ignore_keys: string[]) {
    // Interpolate component to fully resolve edges between services/dependencies
    // Important for host overrides where values might comes from parameters
    const component_string = replaceBrackets(serialize(initial_component));
    const context: any = initial_component.getContext();
    const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    let matches;
    while ((matches = services_regex.exec(component_string)) != null) {
      const [_, service_name, interface_name] = matches;
      if (!context.services[service_name]) { context.services[service_name] = { interfaces: {} }; }
      context.services[service_name].interfaces[interface_name] = {
        host: `@@{{ services.${service_name}.interfaces.${interface_name}.host }}`,
        url: `@@{{ services.${service_name}.interfaces.${interface_name}.url }}`,
        port: `@@{{ services.${service_name}.interfaces.${interface_name}.port }}`,
        protocol: `@@{{ services.${service_name}.interfaces.${interface_name}.protocol }}`,
      };
    }

    const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = dependencies_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;
      if (!context.dependencies[dep_name]) { context.dependencies[dep_name] = {}; }
      if (!context.dependencies[dep_name].interfaces) { context.dependencies[dep_name].interfaces = {}; }
      context.dependencies[dep_name].interfaces[interface_name] = {
        host: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.host }}`,
        url: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.url }}`,
        port: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.port }}`,
        protocol: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.protocol }}`,
      };
    }

    const interpolated_component_string = interpolateString(component_string, context, ignore_keys).replace(/@@{{/g, '${{');
    const component = deserialize(initial_component.getClass(), interpolated_component_string) as ComponentConfig;
    return component;
  }

  static getComponentEdges(graph: DependencyGraph, component: ComponentConfig, instance_id: string): DependencyEdge[] {
    const edges = [];
    // Add edges FROM services to other services
    for (const [service_name, service_config] of Object.entries({ ...component.getTasks(), ...component.getServices() })) {
      const from = component.getServiceRef(service_name, instance_id);
      const from_node = graph.getNodeByRef(from);
      if (from_node.is_external) {
        continue;
      }

      const service_string = serialize(service_config);

      // Add edges between services inside the component and dependencies
      const services_regex = new RegExp(`\\\${{\\s*services\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const service_edge_map: Dictionary<Dictionary<string>> = {};
      let matches;
      while ((matches = services_regex.exec(service_string)) != null) {
        const [_, service_name, interface_name] = matches;
        const to = component.getServiceRef(service_name, instance_id);
        if (to === from) continue;
        if (!service_edge_map[to]) service_edge_map[to] = {};
        service_edge_map[to][`service->${interface_name}`] = interface_name;
      }
      for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
        const edge = new ServiceEdge(from, to, interfaces_map);
        edges.push(edge);
      }

      // Add edges between services and dependencies inside the component
      const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const dep_edge_map: Dictionary<Dictionary<string>> = {};
      while ((matches = dependencies_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.getDependencies()[dep_name];

        const to = `${dep_name}:${dep_tag}${InterfaceSlugUtils.Suffix}`;
        if (!graph.nodes_map.has(to)) continue;

        if (!dep_edge_map[to]) dep_edge_map[to] = {};
        dep_edge_map[to][`service->${interface_name}`] = interface_name;
      }


      for (const [to, interfaces_map] of Object.entries(dep_edge_map)) {
        const edge = new ServiceEdge(from, to, interfaces_map);
        edges.push(edge);
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
      const to = component.getServiceRef(service_name, instance_id);
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

      const to = `${dep_name}:${dep_tag}${InterfaceSlugUtils.Suffix}`;
      if (!graph.nodes_map.has(to)) continue;

      if (!service_edge_map[to]) service_edge_map[to] = {};
      service_edge_map[to][component_interface_name] = interface_name;
    }

    for (const [to, interfaces_map] of Object.entries(service_edge_map)) {
      const edge = new ServiceEdge(component.getInterfacesRef(), to, interfaces_map);
      edges.push(edge);
    }

    return edges;
  }

  static setValuesForComponent(component: ComponentConfig, all_values: Dictionary<Dictionary<string>>) {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(all_values).sort();
    const sorted_values_dict: Dictionary<Dictionary<string>> = {};
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
            component.setParameter(param_key, param_value);
          }
        }
      }
    }
  }

  static interpolateComponent(initial_component: ComponentConfig, instance_id: string, external_address: string, dependencies: ComponentConfig[]) {
    const component = initial_component;
    const component_string = replaceBrackets(serialize(component.expand()));

    const context = component.getContext();

    context.environment = {
      ingresses: {},
    };

    const [external_host, external_port] = external_address.split(':');

    const dependencies_map: Dictionary<ComponentConfig> = {};
    for (const dependency of dependencies) {
      dependencies_map[dependency.getRef()] = dependency;
    }

    let matches;
    const ingresses_regex = new RegExp(`\\\${{\\s*environment\\.ingresses\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = ingresses_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;

      let dep_component;

      if (dep_name === initial_component.getName()) {
        dep_component = initial_component;
      } else {
        const dep_tag = component.getDependencies()[dep_name];
        if (!dep_tag) { continue; }
        dep_component = dependencies_map[`${dep_name}:${dep_tag}`];
      }
      if (!dep_component) { continue; }

      const dependency_interface = dep_component.getInterfaces()[interface_name];
      if (!dependency_interface) { continue; }

      if (!dependency_interface.external_name) {
        dependency_interface.external_name = dep_component.getServiceRef(interface_name, '');
        dep_component.setInterface(interface_name, dependency_interface);
      }
      const interface_from = dependency_interface.external_name;

      const external_interface: InterfaceSpec = {
        host: `${interface_from}.${external_host}`,
        port: external_port,
        protocol: external_host === 'localhost' ? 'http' : 'https',
        username: '',
        password: '',
      };
      external_interface.url = `${external_interface.protocol}://${external_interface.host}`;
      if (external_interface.port !== '80' && external_interface.port !== '443') {
        external_interface.url = `${external_interface.url}:${external_interface.port}`;
      }

      if (!context.environment.ingresses[dep_name]) {
        context.environment.ingresses[dep_name] = {};
      }
      context.environment.ingresses[dep_name][interface_name] = external_interface;
    }

    let proxy_port = 12345;
    const proxy_port_mapping: Dictionary<string> = {};

    const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = dependencies_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;

      const dep_tag = component.getDependencies()[dep_name];
      if (!dep_tag) { continue; }
      const dependency = dependencies_map[`${dep_name}:${dep_tag}`];
      if (!dependency) { continue; }
      const dependency_interface = dependency.getInterfaces()[interface_name];
      if (!dependency_interface) { continue; }

      if (!context.dependencies[dep_name]) { context.dependencies[dep_name] = {}; }
      if (!context.dependencies[dep_name].interfaces) { context.dependencies[dep_name].interfaces = {}; }
      context.dependencies[dep_name].interfaces[interface_name] = dependency_interface;

      if (external_host !== 'localhost') {
        const dep_interfaces_ref = dependency.getInterfacesRef();
        const consul_service = `${dep_interfaces_ref}--${interface_name}`;
        if (!proxy_port_mapping[consul_service]) {
          proxy_port_mapping[consul_service] = `${proxy_port}`;
          proxy_port += 1;
        }

        context.dependencies[dep_name].interfaces[interface_name] = {
          ...context.dependencies[dep_name].interfaces[interface_name],
          host: '127.0.0.1',
          port: proxy_port_mapping[consul_service],
        };
      }
    }

    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      const service_ref = component.getServiceRef(service_name, instance_id);
      for (const [interface_name, interface_config] of Object.entries(service_config.getInterfaces())) {
        const consul_service = `${service_ref}--${interface_name}`;
        if (!proxy_port_mapping[consul_service]) {
          proxy_port_mapping[consul_service] = `${proxy_port}`;
          proxy_port += 1;
        }

        // TODO:207 host overrides
        const internal_host = external_host === 'localhost' ? interface_config.host || component.getServiceRef(service_name, instance_id) : '127.0.0.1';
        const internal_port = external_host === 'localhost' ? interface_config.port : proxy_port_mapping[consul_service];
        const internal_protocol = interface_config.protocol || 'http';
        let internal_url;
        if (interface_config.username && interface_config.password) {
          internal_url = `${internal_protocol}://${interface_config.username}:${interface_config.password}@${internal_host}`;
        } else {
          internal_url = `${internal_protocol}://${internal_host}`;
        }
        if (interface_config.port !== '80' && interface_config.port !== '443') {
          internal_url = `${internal_url}:${interface_config.port}`;
        }

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
    // Two-pass interpolation to detect optional host overrides
    const first_interpolated_component_string = interpolateString(component_string, context, ignore_keys);
    const first_interpolated_component_config = deserialize(component.getClass(), first_interpolated_component_string, { enableImplicitConversion: true }) as ComponentConfig;
    for (const [service_name, service_config] of Object.entries(first_interpolated_component_config.getServices())) {
      for (const [interface_name, interface_config] of Object.entries(service_config.getInterfaces())) {
        if (!interface_config.host) {
          const internal_host = external_host === 'localhost' ? interface_config.host || component.getServiceRef(service_name, instance_id) : '127.0.0.1';
          const internal_port = external_host === 'localhost' ? interface_config.port : 'TODO:207';
          const internal_protocol = interface_config.protocol || 'http';
          let internal_url;
          if (interface_config.username && interface_config.password) {
            internal_url = `${internal_protocol}://${interface_config.username}:${interface_config.password}@${internal_host}`;
          } else {
            internal_url = `${internal_protocol}://${internal_host}`;
          }
          if (interface_config.port !== '80' && interface_config.port !== '443') {
            internal_url = `${internal_url}:${interface_config.port}`;
          }

          context['services'][service_name]['interfaces'][interface_name].url = internal_url;
          context['services'][service_name]['interfaces'][interface_name].host = internal_host;
        }
      }
    }

    const component_string2 = replaceBrackets(serialize(component.expand()));
    const interpolated_component_string = interpolateString(component_string2, context, ignore_keys);
    const interpolated_component_config = deserialize(component.getClass(), interpolated_component_string, { enableImplicitConversion: true }) as ComponentConfig;

    return { interpolated_component_config, proxy_port_mapping };
  }
}
