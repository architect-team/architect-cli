import { deserialize, serialize } from 'class-transformer';
import { ValidationError } from 'class-validator';
import { isMatch } from 'matcher';
import DependencyGraph from './graph';
import DependencyEdge from './graph/edge';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { InterfaceSpec } from './spec/common/interface-spec';
import { ComponentConfig } from './spec/component/component-config';
import { Dictionary } from './utils/dictionary';
import { flattenValidationErrors, ValidationErrors } from './utils/errors';
import { interpolateString, replaceBrackets } from './utils/interpolation';
import { ComponentSlugUtils, Slugs } from './utils/slugs';
import { validateInterpolation } from './utils/validation';

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

  interpolateInterfaces(initial_component: ComponentConfig, ignore_keys: string[]) {
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
        username: `@@{{ services.${service_name}.interfaces.${interface_name}.username }}`,
        password: `@@{{ services.${service_name}.interfaces.${interface_name}.password }}`,
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
        username: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.username }}`,
        password: `@@{{ dependencies.${dep_name}.interfaces.${interface_name}.password }}`,
      };
    }

    const interpolated_component_string = interpolateString(component_string, context, ignore_keys).replace(/@@{{/g, '${{');
    const component = deserialize(initial_component.getClass(), interpolated_component_string) as ComponentConfig;
    return component;
  }

  getComponentEdges(graph: DependencyGraph, component: ComponentConfig, component_configs: ComponentConfig[]): DependencyEdge[] {
    const dependency_components = this.getDependencyComponents(component, component_configs);
    const dependency_map: Dictionary<ComponentConfig> = {};
    for (const dependency_component of dependency_components) {
      dependency_map[dependency_component.getRef()] = dependency_component;
    }

    const edges = [];
    // Add edges FROM services to other services
    for (const [service_name, service_config] of Object.entries({ ...component.getTasks(), ...component.getServices() })) {
      const from = component.getNodeRef(service_name);
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
        const to = component.getNodeRef(service_name);
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

        const dependency = dependency_map[`${dep_name}:${dep_tag}`];
        if (!dependency) continue;
        const to = dependency.getInterfacesRef();

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
      edges.push(edge);
    }

    return edges;
  }

  setValuesForComponent(component: ComponentConfig, all_values: Dictionary<Dictionary<string>>) {
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

  interpolateComponent(initial_component: ComponentConfig, external_address: string, dependencies: ComponentConfig[]) {
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

    const ingresses: Dictionary<string> = {};
    let matches;
    // Deprecated environment.ingresses
    const environment_ingresses_regex = new RegExp(`\\\${{\\s*environment\\.ingresses\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = environment_ingresses_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;
      ingresses[dep_name] = interface_name;
    }
    const dependencies_ingresses_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = dependencies_ingresses_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;
      ingresses[dep_name] = interface_name;
    }
    const ingresses_regex = new RegExp(`\\\${{\\s*ingresses\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = ingresses_regex.exec(component_string)) != null) {
      const [_, interface_name] = matches;
      ingresses[initial_component.getName()] = interface_name;
    }

    for (const [dep_name, interface_name] of Object.entries(ingresses)) {
      if (!context.environment.ingresses[dep_name]) {
        context.environment.ingresses[dep_name] = {};
      }

      let ingresses_context;
      let dep_component;

      if (dep_name === initial_component.getName()) {
        dep_component = initial_component;

        if (!context.ingresses) {
          context.ingresses = {};
        }
        ingresses_context = context.ingresses;
      } else {
        const dep_tag = component.getDependencies()[dep_name];
        if (!dep_tag) { continue; }
        dep_component = dependencies_map[`${dep_name}:${dep_tag}`];

        if (!context.dependencies[dep_name]) {
          context.dependencies[dep_name] = {};
        }
        if (!context.dependencies[dep_name].ingresses) {
          context.dependencies[dep_name].ingresses = {};
        }
        ingresses_context = context.dependencies[dep_name].ingresses;
      }
      if (!dep_component) {
        context.environment.ingresses[dep_name][interface_name] = {
          host: 'not-found.localhost',
          port: '404',
          protocol: 'http',
          url: 'http://not-found.localhost:404',
          username: '',
          password: '',
        };
        continue;
      }

      const dependency_interface = dep_component.getInterfaces()[interface_name];
      if (!dependency_interface) { continue; }

      if (!dependency_interface.external_name) {
        dependency_interface.external_name = dep_component.getNodeRef(interface_name);
        dep_component.setInterface(interface_name, dependency_interface);
      }
      const interface_from = dependency_interface.external_name;

      const external_interface: InterfaceSpec = {
        host: `${interface_from}.${external_host}`,
        port: external_port,
        protocol: external_host.endsWith('localhost') ? 'http' : 'https',
        username: '',
        password: '',
      };
      external_interface.url = this.generateUrl(external_interface);

      context.environment.ingresses[dep_name][interface_name] = external_interface; // Deprecated environment.ingresses
      ingresses_context[interface_name] = external_interface;
    }

    let proxy_port = 12345;
    const proxy_port_mapping: Dictionary<string> = {};

    const dependencies_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
    while ((matches = dependencies_regex.exec(component_string)) != null) {
      const [_, dep_name, interface_name] = matches;

      if (!context.dependencies[dep_name]) { context.dependencies[dep_name] = {}; }
      if (!context.dependencies[dep_name].interfaces) { context.dependencies[dep_name].interfaces = {}; }

      const dep_tag = component.getDependencies()[dep_name];
      if (!dep_tag) { continue; }
      const dependency = dependencies_map[`${dep_name}:${dep_tag}`];
      if (!dependency) {
        context.dependencies[dep_name].interfaces[interface_name] = {
          host: 'not-found.localhost',
          port: '404',
          protocol: 'http',
          url: 'http://not-found.localhost:404',
          username: '',
          password: '',
        };
        continue;
      }
      const dependency_interface = dependency.getInterfaces()[interface_name];
      if (!dependency_interface) { continue; }

      context.dependencies[dep_name].interfaces[interface_name] = dependency_interface;

      if (this.use_sidecar) {
        const sidecar_service = `${dependency.getInterfacesRef()}--${interface_name}`;

        if (!proxy_port_mapping[sidecar_service]) {
          proxy_port_mapping[sidecar_service] = `${proxy_port}`;
          proxy_port += 1;
        }

        context.dependencies[dep_name].interfaces[interface_name] = {
          ...context.dependencies[dep_name].interfaces[interface_name],
          host: '127.0.0.1',
          port: proxy_port_mapping[sidecar_service],
          url: this.generateUrl(dependency_interface, '127.0.0.1', proxy_port_mapping[sidecar_service]),
        };
      }
    }

    for (const [service_name, service_config] of Object.entries(component.getServices())) {
      for (const [interface_name, interface_config] of Object.entries(service_config.getInterfaces())) {
        const service_ref = component.getNodeRef(service_name);
        const internal_host = interface_config.host || service_ref;
        const internal_port = interface_config.port;

        if (this.use_sidecar) {
          const sidecar_service = `${service_ref}--${interface_name}`;
          if (!proxy_port_mapping[sidecar_service]) {
            proxy_port_mapping[sidecar_service] = `${proxy_port}`;
            proxy_port += 1;
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

    const errors = this.validateComponent(component, context, ignore_keys);
    if (errors.length) {
      throw new ValidationErrors(component.getRef(), flattenValidationErrors(errors));
    }

    // Two-pass interpolation to detect optional host overrides
    const first_interpolated_component_string = interpolateString(component_string, context, ignore_keys);
    const first_interpolated_component_config = deserialize(component.getClass(), first_interpolated_component_string) as ComponentConfig;
    for (const [service_name, service_config] of Object.entries(first_interpolated_component_config.getServices())) {
      for (const [interface_name, interface_config] of Object.entries(service_config.getInterfaces())) {
        const service_ref = component.getNodeRef(service_name);
        if (!interface_config.host) {
          let internal_host = component.getNodeRef(service_name);
          let internal_port = interface_config.port;

          if (this.use_sidecar) {
            const sidecar_service = `${service_ref}--${interface_name}`;
            internal_host = '127.0.0.1';
            internal_port = proxy_port_mapping[sidecar_service];
          }
          const internal_url = this.generateUrl(interface_config, internal_host, internal_port);

          context['services'][service_name]['interfaces'][interface_name].url = internal_url;
          context['services'][service_name]['interfaces'][interface_name].host = internal_host;
          context['services'][service_name]['interfaces'][interface_name].port = internal_port;
        }
      }
    }

    const interpolated_component_string = interpolateString(component_string, context, ignore_keys);
    const interpolated_component_config = deserialize(component.getClass(), interpolated_component_string) as ComponentConfig;

    // TODO:207
    // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
    // @ts-ignore
    interpolated_component_config.proxy_port_mapping = proxy_port_mapping;
    return interpolated_component_config;
  }

  async interpolateComponents(component_configs: ComponentConfig[], external_address: string, values?: Dictionary<Dictionary<string>>) {
    for (const component_config of component_configs) {
      if (values) {
        // Set parameters from secrets
        this.setValuesForComponent(component_config, values);
      }
    }

    const _interpolated_component_map: Dictionary<Promise<ComponentConfig>> = {};

    for (const component_config of component_configs) {
      const map_key = `${component_config.getRef()}@${component_config.getInstanceId()}`;
      if (!_interpolated_component_map[map_key]) {
        _interpolated_component_map[map_key] = this.interpolateComponentWithDependencies(component_config, component_configs, external_address, _interpolated_component_map, component_config.getRef());
      }
    }

    const interpolated_component_configs = await Promise.all(Object.values(_interpolated_component_map));
    return interpolated_component_configs;
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

  getDependencyComponents(component_config: ComponentConfig, component_configs: ComponentConfig[], _parent_ref = '') {
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
      if (dep_ref === _parent_ref) {
        throw new Error(`Circular component dependency detected (${component_config.getRef()} <> ${_parent_ref})`);
      }
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

  async interpolateComponentWithDependencies(component_config: ComponentConfig, component_configs: ComponentConfig[], external_address: string, _interpolated_component_map: Dictionary<Promise<ComponentConfig>> = {}, _parent_ref = '', depth = 0) {
    if (depth > 50) {
      throw new Error(`Circular component dependency detected`);
    }

    const dependency_components = this.getDependencyComponents(component_config, component_configs, _parent_ref);
    const dependency_promises = [];
    for (const dependency_component of dependency_components) {
      const map_key = `${dependency_component.getRef()}@${dependency_component.getInstanceId()}`;
      if (!_interpolated_component_map[map_key]) {
        _interpolated_component_map[map_key] = this.interpolateComponentWithDependencies(dependency_component, component_configs, external_address, _interpolated_component_map, component_config.getRef(), depth + 1);
      }
      dependency_promises.push(_interpolated_component_map[map_key]);
    }
    const dependencies = await Promise.all(dependency_promises);

    return this.interpolateComponent(component_config, external_address, dependencies);
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
    return [...validation_errors, ...validateInterpolation(serialize(component), context, ignore_keys)];
  }
}
