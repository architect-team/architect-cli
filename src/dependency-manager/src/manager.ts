import { serialize } from 'class-transformer';
import { isMatch } from 'matcher';
import { buildComponentRef, buildInterfacesRef, buildNodeRef, ComponentConfig, ComponentInterfaceConfig } from './config/component-config';
import { ComponentContext, ParameterValue } from './config/component-context';
import DependencyGraph from './graph';
import IngressEdge from './graph/edge/ingress';
import OutputEdge from './graph/edge/output';
import ServiceEdge from './graph/edge/service';
import { DependencyNode } from './graph/node';
import ComponentNode from './graph/node/component';
import GatewayNode from './graph/node/gateway';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec, transformParameterDefinitionSpec } from './spec/transform/component-transform';
import { ComponentSlugUtils, Slugs } from './spec/utils/slugs';
import { validateOrRejectSpec } from './spec/utils/spec-validator';
import { Dictionary, transformDictionary } from './utils/dictionary';
import { ArchitectError, ValidationError, ValidationErrors } from './utils/errors';
import { interpolateObjectOrReject, replaceInterpolationBrackets } from './utils/interpolation';
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
        local_path: component.metadata.file?.path,
        artifact_image: component.artifact_image,
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.tasks)) {
      const node = new TaskNode({
        ref: buildNodeRef(component, task_name),
        config: task_config,
        local_path: component.metadata.file?.path,
      });
      nodes.push(node);
    }
    return nodes;
  }

  interpolateInterfaces(initial_component: ComponentConfig): ComponentConfig {
    return initial_component;
    /* TODO:333
    // Interpolate component to fully resolve edges between dependencies/ingress/services
    // Important for host overrides where values might comes from parameters
    const source_yml = replaceInterpolationBrackets(initial_component.source_yml);
    const context: ComponentContext = JSON.parse(JSON.stringify(initial_component.context));

    const interpolation_regex = new RegExp(`\\\${{\\s*(.*?)\\s*}}`, 'g');
    let matches;

    while ((matches = interpolation_regex.exec(source_yml)) != null) {
      const [_, match] = matches;
      const names = match.split('.');

      if (!(match.includes('ingresses.') || match.includes('interfaces.') || match.includes('outputs.'))) {
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

    const x = interpolateObjectOrReject(initial_component, context, ignore_keys);
    const y = classToPlain(x).replace(/__arc__{{/g, '${{');


    // TODO:333 const interpolated_component_config = transformComponentSpec(parsed_yml as ComponentSpec, interpolated_component_string, initial_component.tag, initial_component.metadata);
    // @ts-ignore
    return plainToClass(ComponentConfig, y);
    */
  }

  addComponentEdges(graph: DependencyGraph, component_config: ComponentConfig, dependency_configs: ComponentConfig[], context_map: Dictionary<ComponentContext>, external_addr: string): void {
    const component = component_config;

    const dependency_map: Dictionary<ComponentConfig> = {};
    for (const dependency_component of dependency_configs) {
      const dependency_ref = buildComponentRef(dependency_component);
      dependency_map[dependency_ref] = dependency_component;
    }

    // Add edges FROM services to other services
    for (const [resource_name, resource_config] of Object.entries({ ...component.tasks, ...component.services })) {
      const from = buildNodeRef(component, resource_name);
      const from_node = graph.getNodeByRef(from);

      const service_string = serialize(resource_config);
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

      // TODO:333 const context = context_map[component.metadata.ref];

      for (const [dep_component, interface_name] of ingresses) {
        if (!dep_component) { continue; }
        if (!dep_component.interfaces[interface_name]) { continue; }

        const dep_context = context_map[dep_component.metadata.ref];
        const subdomain = dep_context.ingresses[interface_name]?.subdomain;
        if (!subdomain) { continue; }

        let ingress_edge = graph.edges.find(edge => edge.from === 'gateway' && edge.to === buildInterfacesRef(dep_component)) as IngressEdge;
        if (!ingress_edge) {
          const gateway_host = external_addr.split(':')[0];
          const gateway_port = parseInt(external_addr.split(':')[1] || '443');
          const gateway_node = new GatewayNode(gateway_host, gateway_port);
          gateway_node.instance_id = 'gateway';
          graph.addNode(gateway_node);

          ingress_edge = new IngressEdge('gateway', buildInterfacesRef(dep_component), []);
          graph.addEdge(ingress_edge);
        }

        if (!ingress_edge.interface_mappings.find((i) => i.interface_from === subdomain && i.interface_to === interface_name)) {
          ingress_edge.interface_mappings.push({ interface_from: subdomain, interface_to: interface_name });
        }

        if (!ingress_edge.consumers_map[interface_name]) {
          ingress_edge.consumers_map[interface_name] = new Set();
        }
        ingress_edge.consumers_map[interface_name].add(from);
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
        const interface_mappings = Object.entries(interfaces_map).map(([interface_from, interface_to]) => ({ interface_from, interface_to }));
        const edge = new ServiceEdge(from, to, interface_mappings);
        graph.addEdge(edge);
      }

      // Add edges between services and interface dependencies inside the component
      const dep_interface_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.interfaces\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?\\.`, 'g');
      const dep_service_edge_map: Dictionary<Dictionary<string>> = {};
      while ((matches = dep_interface_regex.exec(service_string)) != null) {
        const [_, dep_name, interface_name] = matches;
        const dep_tag = component.dependencies[dep_name];

        const dependency = dependency_map[`${dep_name}:${dep_tag}`];
        if (!dependency) continue;
        const to = buildInterfacesRef(dependency);

        if (!graph.nodes_map.has(to)) continue;

        if (!dep_service_edge_map[to]) dep_service_edge_map[to] = {};
        dep_service_edge_map[to][`service->${interface_name}`] = interface_name;
      }
      for (const [to, interfaces_map] of Object.entries(dep_service_edge_map)) {
        const interface_mappings = Object.entries(interfaces_map).map(([interface_from, interface_to]) => ({ interface_from, interface_to }));
        const edge = new ServiceEdge(from, to, interface_mappings);
        graph.addEdge(edge);
      }

      // Add edges between services and output dependencies inside the component
      const dep_output_regex = new RegExp(`\\\${{\\s*dependencies\\.(${ComponentSlugUtils.RegexNoMaxLength})?\\.outputs\\.(${Slugs.ArchitectSlugRegexNoMaxLength})?`, 'g');
      const dep_output_edge_map: Dictionary<Dictionary<string>> = {};
      while ((matches = dep_output_regex.exec(service_string)) != null) {
        const [_, dep_name, output_name] = matches;
        const dep_tag = component.dependencies[dep_name];

        const dependency = dependency_map[`${dep_name}:${dep_tag}`];
        if (!dependency) continue;
        const to = buildInterfacesRef(dependency);

        if (!graph.nodes_map.has(to)) continue;

        if (!dep_output_edge_map[to]) dep_output_edge_map[to] = {};
        dep_output_edge_map[to][`output->${output_name}`] = output_name;
      }
      for (const [to, output_map] of Object.entries(dep_output_edge_map)) {
        const output_mappings = Object.entries(output_map).map(([interface_from, interface_to]) => ({ interface_from, interface_to }));
        const edge = new OutputEdge(from, to, output_mappings);
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

    for (const [component_interface_name, component_interface] of Object.entries(component.interfaces || {})) {
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
      const interface_mappings = Object.entries(interfaces_map).map(([interface_from, interface_to]) => ({ interface_from, interface_to }));
      const edge = new ServiceEdge(buildInterfacesRef(component), to, interface_mappings);
      graph.addEdge(edge);
    }
  }

  /* TODO:333
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
  */

  getSecretsForComponentSpec(component_spec: ComponentSpec, all_values: Dictionary<Dictionary<string | null>>): Dictionary<ParameterValue> {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(all_values).sort();
    const sorted_values_dict: Dictionary<Dictionary<string | null>> = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = all_values[key];
    }

    const component_ref = component_spec.metadata.ref;
    const component_has_tag = component_ref.includes(':');

    const component_parameters = new Set(Object.keys(component_spec.parameters || {}));

    const res: Dictionary<any> = {};
    // add values from values file to all existing, matching components
    for (const [pattern, params] of Object.entries(sorted_values_dict)) {
      if (isMatch(component_has_tag ? component_ref : `${component_ref}:latest`, [pattern])) {
        for (const [param_key, param_value] of Object.entries(params)) {
          if (component_parameters.has(param_key)) {
            res[param_key] = param_value;
          }
        }
      }
    }
    return res;
  }

  generateUrl(interface_ref: string): string {
    const url_auth = `(${interface_ref}.password ? (${interface_ref}.username + ':' + ${interface_ref}.password + '@') : '')`;
    const url_protocol = `(${interface_ref}.protocol == 'grpc' ? '' : (${interface_ref}.protocol + '://' + ${url_auth}))`;
    const url_port = `((${interface_ref}.port == 80 || ${interface_ref}.port == 443) ? '' : ':' + ${interface_ref}.port)`;
    return `\${{ ${url_protocol} + ${interface_ref}.host + ${url_port} }}`;
  }

  getIngressesContext(graph: DependencyGraph, edge: IngressEdge, interface_from: string, interface_to: string, external_address: string, dependency?: ComponentConfig, is_dependency = true): ComponentInterfaceConfig | undefined {
    let partial_external_interface: Partial<ComponentInterfaceConfig>;

    const interface_mapping = graph.followEdge(edge).find((x) => x.interface_from === interface_from && x.interface_to === interface_to);
    if (!interface_mapping) {
      return;
    }
    const { node_to, node_to_interface_name } = interface_mapping;

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
        port: parseInt(external_port),
        protocol: external_host === 'arc.localhost' ? 'http' : 'https',
        username: '',
        password: '',
        subdomain: interface_from,
        dns_zone: external_host,
      };
    }
    const interface_ref = dependency && is_dependency ? `dependencies.${dependency.name}.ingresses.${interface_to}` : `ingresses.${interface_to}`;
    const external_interface = {
      ...partial_external_interface,
      username: '',
      password: '',
      url: this.generateUrl(interface_ref),
    };
    return external_interface;
  }

  /* TODO:333
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
      port: 404,
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

          const interface_ref = `dependencies.${dependency.name}.interfaces.${interface_name}`;
          context.dependencies[dependency.name].interfaces[interface_name] = {
            ...context.dependencies[dependency.name].interfaces[interface_name],
            host: '127.0.0.1',
            port: proxy_port_mapping[sidecar_service],
            url: this.generateUrl(interface_ref),
          };
        }
      }
    }

    for (const dependency of [initial_component, ...dependencies]) {
      // Set dependency and component ingresses
      const ingress_edges = graph.edges.filter(edge => edge.from === 'gateway' && edge.to === buildInterfacesRef(dependency)) as IngressEdge[];
      for (const ingress_edge of ingress_edges) {
        for (const { interface_from, interface_to } of ingress_edge.interface_mappings) {
          const is_dependency = buildComponentRef(dependency) !== buildComponentRef(initial_component);
          const external_interface = this.getIngressesContext(graph, ingress_edge, interface_from, interface_to, external_address, dependency, is_dependency);

          if (!external_interface) {
            continue;
          }

          if (!context.environment.ingresses[dependency.name]) {
            context.environment.ingresses[dependency.name] = {};
          }
          context.environment.ingresses[dependency.name][interface_to] = external_interface; // Deprecated environment.ingresses

          if (!is_dependency) {
            context.ingresses[interface_to] = external_interface;
            context.ingresses[interface_to].consumers = [];

            if (ingress_edge.consumers_map[interface_from]) {
              const interfaces_refs = graph.edges.filter(edge => ingress_edge.consumers_map[interface_from].has(edge.to) && graph.getNodeByRef(edge.from) instanceof ComponentNode).map(edge => edge.from);
              const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && interfaces_refs.includes(edge.to)) as IngressEdge[];
              const consumers: string[] = [];
              for (const consumer_ingress_edge of consumer_ingress_edges) {
                for (const { interface_from: consumer_interface_from, interface_to: consumer_interface_to } of consumer_ingress_edge.interface_mappings) {
                  // TODO:333
                  const consumer_interface = this.getIngressesContext(graph, consumer_ingress_edge, consumer_interface_from, consumer_interface_to, external_address);
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
        const interface_ref = `services.${service_name}.interfaces.${interface_name}`;
        const internal_url = this.generateUrl(interface_ref);

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
  */

  findClosestComponent(component_configs: ComponentSpec[], date: Date): ComponentSpec | undefined {
    if (component_configs.length === 0) { return; }
    if (component_configs.length === 1) { return component_configs[0]; }

    const target_time = date.getTime();

    let res = undefined;
    let best_diff = Number.NEGATIVE_INFINITY;
    for (const component_config of component_configs) {
      if (!component_config.metadata) {
        throw new Error(`Metadata has not been set on component: ${component_config.name}`);
      }
      const current_time = component_config.metadata.instance_date.getTime();
      const current_diff = current_time - target_time;
      if (current_diff <= 0 && current_diff > best_diff) {
        best_diff = current_diff;
        res = component_config;
      }
    }
    return res;
  }

  getDependencyComponents(component_spec: ComponentSpec, component_specs: ComponentSpec[]): ComponentSpec[] {
    const component_map: Dictionary<ComponentSpec[]> = {};
    for (const component_spec of component_specs) {
      const ref = component_spec.metadata.ref;
      if (!component_map[ref]) {
        component_map[ref] = [];
      }
      // Potentially multiple components with the same ref and different instance ids
      component_map[ref].push(component_spec);
    }

    const dependency_components = [];
    for (const [dep_name, dep_tag] of Object.entries(component_spec.dependencies || {})) {
      const dep_ref = `${dep_name}:${dep_tag}`;
      if (!component_map[dep_ref]) {
        continue;
      }
      const dep_components = component_map[dep_ref];
      if (!component_spec.metadata) {
        throw new Error(`Metadata has not been set on component: ${component_spec.name}`);
      }
      const dep_component = this.findClosestComponent(dep_components, component_spec.metadata.instance_date || new Date());
      if (!dep_component) {
        continue;
      }
      dependency_components.push(dep_component);
    }
    return dependency_components;
  }

  validateRequiredParameters(component: ComponentConfig, parameters: Dictionary<ParameterValue>): void {
    const validation_errors = [];
    // Check required parameters for components
    for (const [pk, pv] of Object.entries(component.parameters)) {
      if (pv.required !== false && (pv.default === undefined) && !(pk in parameters)) {
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
      throw new ValidationErrors(validation_errors, component.metadata.file);
    }
  }

  validateGraph(graph: DependencyGraph): void {
    // Check for duplicate subdomains
    const seen_subdomains: Dictionary<string[]> = {};
    for (const ingress_edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      for (const { interface_from, interface_to } of ingress_edge.interface_mappings) {
        const component_node = graph.getNodeByRef(ingress_edge.to) as ComponentNode;
        const ingress = component_node.config.interfaces[interface_to].ingress;
        const key = ingress?.path ? `${interface_from} with path ${ingress.path}` : interface_from;
        if (!seen_subdomains[key]) {
          seen_subdomains[key] = [];
        }
        seen_subdomains[key].push(`${component_node.slug}.${interface_to}`);
      }
    }

    for (const [subdomain, values] of Object.entries(seen_subdomains)) {
      if (values.length > 1) {
        throw new ArchitectError(`The subdomain ${subdomain} is claimed by multiple component interfaces:\n[${values.sort().join(', ')}]\nPlease set interfaces.<name>.ingress.subdomain=<subdomain> or interfaces.<name>.ingress.path=<path> to avoid conflicts.`);
      }
    }
  }

  async getGraph(component_specs: ComponentSpec[], all_secrets: Dictionary<Dictionary<string | null>> = {}, interpolate = true, validate = true, external_addr: string): Promise<DependencyGraph> {
    ValuesConfig.validate(all_secrets);

    const graph = new DependencyGraph();

    const context_map: Dictionary<ComponentContext> = {};

    const evaluated_component_specs: ComponentSpec[] = [];
    for (let component_spec of component_specs) {
      let context: ComponentContext = {
        name: component_spec.name,
        environment: {
          ingresses: {},
        },
        dependencies: {},
        ingresses: {},
        interfaces: {},
        outputs: {},
        parameters: {},
        services: {},
        tasks: {},
      };

      const parameters = transformDictionary(transformParameterDefinitionSpec, component_spec.parameters);
      for (const [key, value] of Object.entries(parameters)) {
        context.parameters[key] = value.default;
      }

      const secrets = this.getSecretsForComponentSpec(component_spec, all_secrets);
      context.parameters = {
        ...context.parameters,
        ...secrets,
      };

      // Interpolate parameters
      context = interpolateObjectOrReject(context, context, { keys: false, values: true });

      // Replace conditionals
      component_spec = interpolateObjectOrReject(component_spec, context, { keys: true, values: false });

      const component_config = transformComponentSpec(component_spec);

      if (validate) {
        this.validateRequiredParameters(component_config, context.parameters || {});
      }

      const nodes = this.getComponentNodes(component_config);

      const has_interfaces = Object.keys(component_config.interfaces).length > 0;
      const has_outputs = Object.keys(component_config.outputs).length > 0;
      if (has_interfaces || has_outputs) {
        const ref = buildComponentRef(component_config);
        const config = {
          outputs: component_config.outputs,
          interfaces: component_config.interfaces,
        };
        const node = new ComponentNode(buildInterfacesRef(component_config), ref, config);
        nodes.push(node);
      }

      for (const node of nodes) {
        node.instance_id = component_config.metadata?.instance_id || '';
        graph.addNode(node);
      }

      // Generate remaining context except ingress.x.consumers and dependencies
      for (const [key, value] of Object.entries(component_config.outputs)) {
        context.outputs[key] = value.value;
      }

      component_spec.metadata.proxy_port_mapping = {};
      for (const [service_name, service] of Object.entries(component_config.services)) {
        if (!context.services[service_name]) {
          context.services[service_name] = {
            interfaces: {},
            environment: {},
          };
        }
        const service_ref = buildNodeRef(component_config, service_name);
        for (const [interface_name, value] of Object.entries(service.interfaces)) {
          const interface_ref = `services.${service_name}.interfaces.${interface_name}`;

          const sidecar_service = `${service_ref}--${interface_name}`;
          component_spec.metadata.proxy_port_mapping[sidecar_service];
          if (!component_spec.metadata.proxy_port_mapping[sidecar_service]) {
            component_spec.metadata.proxy_port_mapping[sidecar_service] = Math.max(12344, ...Object.values(component_spec.metadata.proxy_port_mapping)) + 1;
          }

          const architect_host = this.use_sidecar ? '127.0.0.1' : buildNodeRef(component_config, service_name);
          const architect_port = this.use_sidecar ? component_spec.metadata.proxy_port_mapping[sidecar_service] : value.port;
          context.services[service_name].interfaces[interface_name] = {
            protocol: 'http',
            username: '',
            password: '',
            ...value,
            // @ts-ignore TODO:333
            external_host: value.host,
            port: `\${{ ${interface_ref}.external_host ? ${value.port} : ${architect_port} }}`,
            host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : '${architect_host}' }}`,
            url: this.generateUrl(interface_ref),
          };
        }
      }

      // Set component interfaces
      const [external_host, external_port_string] = external_addr.split(':');
      const external_port = parseInt(external_port_string);
      const external_protocol = external_host === 'arc.localhost' ? 'http' : 'https';
      for (const [interface_name, interface_config] of Object.entries(component_config.interfaces)) {
        const url_regex = new RegExp(`\\\${{\\s*(.*?)\\.url\\s*}}`, 'g');
        const matches = url_regex.exec(interface_config.url);
        if (matches) {
          const interface_ref = matches[1];

          const [services_text, service_name, interfaces_text, service_interface_name] = interface_ref.split('.');
          if (services_text !== 'services') {
            continue;
          }
          if (interfaces_text !== 'interfaces') {
            continue;
          }
          if (!(service_name in context.services)) {
            continue;
          }
          if (!(service_interface_name in context.services[service_name].interfaces)) {
            continue;
          }
          context.interfaces[interface_name] = {
            host: interface_config.host || `\${{ ${interface_ref}.host }}`,
            port: interface_config.port || `\${{ ${interface_ref}.port }}`,
            username: interface_config.username || `\${{ ${interface_ref}.username }}`,
            password: interface_config.password || `\${{ ${interface_ref}.password }}`,
            protocol: interface_config.protocol || `\${{ ${interface_ref}.protocol }}`,
            url: interface_config.url || `\${{ ${interface_ref}.url }}`,
          };

          const ingress_ref = `ingresses.${interface_name}`;
          context.ingresses[interface_name] = {
            dns_zone: external_host,
            subdomain: interface_config.ingress?.subdomain || interface_name,
            host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : (${ingress_ref}.subdomain + '.' + ${ingress_ref}.dns_zone) }}`,
            port: `\${{ ${interface_ref}.external_host ? ${interface_ref}.port : ${external_port} }}`,
            protocol: `\${{ ${interface_ref}.external_host ? ${interface_ref}.protocol : '${external_protocol}' }}`,
            username: '',
            password: '',
            // TODO:333 include ingress.path in url? Add test
            url: this.generateUrl(ingress_ref),
            consumers: [],
          };

          // Deprecated: environment.ingresses
          if (!context.environment.ingresses[component_spec.name]) {
            context.environment.ingresses[component_spec.name] = {};
          }
          context.environment.ingresses[component_spec.name][interface_name] = context.ingresses[interface_name];
        }
      }

      // Interpolate interfaces/ingresses/services
      context = interpolateObjectOrReject(context, context, { keys: false, values: true });

      context_map[component_spec.metadata.ref] = context;
      evaluated_component_specs.push(component_spec);
    }

    // Add edges to graph
    for (const component_spec of evaluated_component_specs) {
      const component_config = transformComponentSpec(component_spec);
      const dependency_specs = this.getDependencyComponents(component_spec, component_specs);
      const dependency_configs = dependency_specs.map(d => transformComponentSpec(d));
      this.addComponentEdges(graph, component_config, dependency_configs, context_map, external_addr);

      for (const edge of graph.edges) {
        const from_node = graph.getNodeByRef(edge.from);
        if (from_node instanceof GatewayNode) {
          const to_node = graph.getNodeByRef(edge.to);
          edge.instance_id = to_node.instance_id;
        } else {
          edge.instance_id = from_node.instance_id;
        }
      }
    }

    // Generate context for dependencies/consumers
    for (let component_spec of evaluated_component_specs) {
      const context = context_map[component_spec.metadata.ref];

      for (const [service_name, service] of Object.entries(component_spec.services || {})) {
        context.services[service_name].environment = service.environment;
      }

      for (const [task_name, task] of Object.entries(component_spec.tasks || {})) {
        if (!context.tasks[task_name]) { context.tasks[task_name] = {}; }
        context.tasks[task_name].environment = task.environment;
      }

      const dependency_specs = this.getDependencyComponents(component_spec, component_specs);
      context.dependencies = {};
      for (const dependency_spec of dependency_specs) {
        const dependency_context = context_map[dependency_spec.metadata.ref];
        context.dependencies[dependency_spec.name] = {
          ingresses: dependency_context.ingresses || {},
          interfaces: dependency_context.interfaces || {},
          outputs: dependency_context.outputs || {},
        };


        for (const [dependency_interface_name, dependency_interface] of Object.entries(context.dependencies[dependency_spec.name].interfaces)) {
          const sidecar_service = `${buildInterfacesRef(dependency_spec)}--${dependency_interface_name}`;
          component_spec.metadata.proxy_port_mapping[sidecar_service];
          if (!component_spec.metadata.proxy_port_mapping[sidecar_service]) {
            component_spec.metadata.proxy_port_mapping[sidecar_service] = Math.max(12344, ...Object.values(component_spec.metadata.proxy_port_mapping)) + 1;
          }
          if (this.use_sidecar && dependency_interface.host === '127.0.0.1') {
            dependency_interface.port = component_spec.metadata.proxy_port_mapping[sidecar_service];
            dependency_interface.url = `${dependency_interface.url.split('127.0.0.1')[0]}127.0.0.1:${dependency_interface.port}`;
          }
        }

        // Deprecated: environment.ingresses
        if (!context.environment.ingresses[dependency_spec.name]) {
          context.environment.ingresses[dependency_spec.name] = {};
        }
        for (const [dep_ingress_name, dep_ingress] of Object.entries(context.dependencies[dependency_spec.name].ingresses)) {
          context.environment.ingresses[dependency_spec.name][dep_ingress_name] = dep_ingress;
        }
      }

      const ingress_edge = graph.edges.find(edge => edge instanceof IngressEdge && edge.to === buildInterfacesRef(component_spec)) as IngressEdge;

      // Set consumers context
      if (ingress_edge) {
        for (const [interface_name, consumer_refs] of Object.entries(ingress_edge.consumers_map)) {
          const interfaces_refs = graph.edges.filter(edge => consumer_refs.has(edge.to) && graph.getNodeByRef(edge.from) instanceof ComponentNode).map(edge => edge.from);
          const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && interfaces_refs.includes(edge.to)) as IngressEdge[];
          const consumers: string[] = [];
          for (const consumer_ingress_edge of consumer_ingress_edges) {
            const interface_node = graph.getNodeByRef(consumer_ingress_edge.to) as ComponentNode;
            const consumer_interface = context_map[interface_node.slug].ingresses || {};
            for (const { interface_to: consumer_interface_to } of consumer_ingress_edge.interface_mappings) {
              consumers.push(consumer_interface[consumer_interface_to].url);
            }
          }
          context.ingresses[interface_name].consumers = consumers.sort();
        }
      }

      component_spec = interpolateObjectOrReject(component_spec, context, { keys: false, values: true });

      if (validate) {
        const component_spec_copy = JSON.parse(JSON.stringify(component_spec));
        delete component_spec_copy.metadata;
        validateOrRejectSpec(component_spec_copy);
      }

      const component_config = transformComponentSpec(component_spec);

      // Add interfaces to ComponentNode of the tree if there are any interfaces defined
      if (Object.keys(component_config.interfaces).length) {
        const component_node = graph.getNodeByRef(buildInterfacesRef(component_config)) as ComponentNode;
        component_node.config.interfaces = component_config.interfaces;
      }

      // Add outputs to ComponentNode of the tree if there are any outputs defined
      if (Object.keys(component_config.outputs).length) {
        const component_node = graph.getNodeByRef(buildInterfacesRef(component_config)) as ComponentNode;
        component_node.config.outputs = component_config.outputs;
      }

      for (const resource_config of Object.values({ ...component_config.services, ...component_config.tasks })) {
        const resource_ref = buildNodeRef(component_config, resource_config.name);
        const node = graph.getNodeByRef(resource_ref) as ServiceNode | TaskNode;
        node.proxy_port_mapping = component_config.metadata.proxy_port_mapping;
        node.config = resource_config;
      }
    }

    if (validate) {
      this.validateGraph(graph);
      graph.validated = true;
    }

    return graph;
  }
}
