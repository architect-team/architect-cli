import { classToPlain, plainToClass, serialize } from 'class-transformer';
import { isMatch } from 'matcher';
import { buildNodeRef, ComponentConfig } from './config/component-config';
import { ArchitectContext, ComponentContext, SecretValue } from './config/component-context';
import { DependencyGraph, DependencyGraphMutable } from './graph';
import { IngressEdge } from './graph/edge/ingress';
import { ServiceEdge } from './graph/edge/service';
import { DependencyNode } from './graph/node';
import { GatewayNode } from './graph/node/gateway';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { GraphOptions } from './graph/type';
import { SecretsConfig } from './secrets/secrets';
import { SecretsDict } from './secrets/type';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec, transformSecretDefinitionSpec } from './spec/transform/component-transform';
import { ComponentSlugUtils, ComponentVersionSlugUtils, ResourceType, Slugs } from './spec/utils/slugs';
import { validateOrRejectSpec } from './spec/utils/spec-validator';
import { Dictionary, transformDictionary } from './utils/dictionary';
import { ArchitectError, ValidationError, ValidationErrors } from './utils/errors';
import { interpolateObjectLoose, interpolateObjectOrReject, replaceInterpolationBrackets } from './utils/interpolation';

export default abstract class DependencyManager {
  account?: string;
  external_addr = 'arc.localhost:80';
  use_ssl = false;
  valid_protocols = new Set(['http', 'https']);

  getComponentNodes(component: ComponentConfig): DependencyNode[] {
    const nodes = [];
    // Load component services
    for (const [service_name, service_config] of Object.entries(component.services)) {
      const node = new ServiceNode({
        ref: buildNodeRef(component, 'services', service_name),
        config: service_config,
        local_path: component.metadata.file?.path,
        artifact_image: component.artifact_image,
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.tasks)) {
      const node = new TaskNode({
        ref: buildNodeRef(component, 'tasks', task_name),
        config: task_config,
        local_path: component.metadata.file?.path,
      });
      nodes.push(node);
    }
    return nodes;
  }

  getComponentRef(component_string: string): string {
    const { component_account_name, component_name, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const resolved_account = this.account && this.account === component_account_name ? undefined : component_account_name;
    const component_ref = ComponentSlugUtils.build(resolved_account, component_name, instance_name);
    return component_ref;
  }

  addIngressEdges(graph: DependencyGraph, component_config: ComponentConfig): void {
    for (const [service_name, service] of Object.entries(component_config.services)) {
      for (const [interface_name, interface_spec] of Object.entries(service.interfaces)) {
        if (interface_spec.ingress?.enabled || interface_spec.ingress?.subdomain) {
          const gateway_host = this.external_addr.split(':')[0];
          const gateway_port = Number.parseInt(this.external_addr.split(':')[1] || '443');

          const gateway_node = new GatewayNode(gateway_host, gateway_port);
          gateway_node.instance_id = gateway_node.ref;
          graph.addNode(gateway_node);

          const ingress_edge = new IngressEdge(gateway_node.ref, buildNodeRef(component_config, 'services', service_name), interface_name);
          graph.addEdge(ingress_edge);
        }

        /* TODO:TJ add back consumers
        if (!ingress_edge.consumers_map[interface_name]) {
          ingress_edge.consumers_map[interface_name] = new Set();
        }
        ingress_edge.consumers_map[interface_name].add(from);
        */
      }
    }
  }

  addComponentEdges(graph: DependencyGraph, component_config: ComponentConfig, dependency_configs: ComponentConfig[], context_map: Dictionary<ComponentContext>): void {
    const component = component_config;

    const dependency_map: Dictionary<ComponentConfig> = {};
    for (const dependency_component of dependency_configs) {
      const dependency_ref = dependency_component.metadata.ref;
      dependency_map[dependency_ref] = dependency_component;
    }

    this.addIngressEdges(graph, component_config);

    // Add edges FROM services to other services
    const services = Object.entries(component_config.services).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'services' as ResourceType, resource_config }));
    const tasks = Object.entries(component_config.tasks).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'tasks' as ResourceType, resource_config }));
    for (const { resource_config, resource_name, resource_type } of [...services, ...tasks]) {
      const from = buildNodeRef(component, resource_type, resource_name);
      const copy = { ...resource_config } as any;
      delete copy.metadata;
      const service_string = replaceInterpolationBrackets(serialize(copy));
      let matches;

      // Add edges between services
      const services_regex = new RegExp(`\\\${{\\s*services\\.(?<service_name>${Slugs.ArchitectSlugRegexBase})\\.interfaces\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.`, 'g');
      while ((matches = services_regex.exec(service_string)) !== null) {
        if (!matches.groups) {
          continue;
        }
        const { service_name, interface_name } = matches.groups;
        const to = buildNodeRef(component, 'services', service_name);

        if (to === from) continue;

        const edge = new ServiceEdge(from, to, interface_name);
        if (!graph.nodes_map.has(to)) continue;
        graph.addEdge(edge);
      }

      // TODO:TJ support dependencies.<name>.services.<name>.interfaces.<name>

      // Deprecated: Add edges between services and interface dependencies inside the component
      const dep_interface_regex = new RegExp(`\\\${{\\s*dependencies\\.(?<dependency_name>${ComponentSlugUtils.RegexBase})\\.interfaces\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.`, 'g');
      while ((matches = dep_interface_regex.exec(service_string)) !== null) {
        if (!matches.groups) {
          continue;
        }
        const { dependency_name, interface_name } = matches.groups;
        const dep_ref = this.getComponentRef(dependency_name);

        const dependency = dependency_map[dep_ref];
        if (!dependency) continue;

        let to = '';
        // TODO:TJ cleanup hack
        for (const [dep_service_name, dep_service] of Object.entries(dependency.services)) {
          if (Object.keys(dep_service.interfaces).includes(interface_name)) {
            to = buildNodeRef(dependency, 'services', dep_service_name);
          }
        }

        if (!graph.nodes_map.has(to)) continue;

        const edge = new ServiceEdge(from, to, interface_name);
        graph.addEdge(edge);
      }
    }
  }

  getSecretsForComponentSpec(component_spec: ComponentSpec, all_secrets: SecretsDict): Dictionary<SecretValue> {
    // pre-sort values dictionary to properly stack/override any colliding keys
    const sorted_values_keys = Object.keys(all_secrets).sort();
    const sorted_values_dict: SecretsDict = {};
    for (const key of sorted_values_keys) {
      sorted_values_dict[key] = all_secrets[key];
    }

    const component_ref = component_spec.metadata.ref;
    const { component_name, instance_name } = ComponentSlugUtils.parse(component_ref);
    const component_ref_with_account = ComponentSlugUtils.build(this.account, component_name, instance_name);

    const component_secrets = new Set(Object.keys({ ...component_spec.parameters, ...component_spec.secrets })); // TODO: 404: update

    const res: Dictionary<any> = {};
    // add values from values file to all existing, matching components
    // eslint-disable-next-line prefer-const
    for (let [pattern, secrets] of Object.entries(sorted_values_dict)) {
      // Backwards compat for tags
      if (ComponentVersionSlugUtils.Validator.test(pattern)) {
        const { component_account_name, component_name, instance_name } = ComponentVersionSlugUtils.parse(pattern);
        pattern = ComponentSlugUtils.build(component_account_name, component_name, instance_name);
      }
      if (isMatch(component_ref, [pattern]) || isMatch(component_ref_with_account, [pattern])) {
        for (const [secret_key, secret_value] of Object.entries(secrets)) {
          if (component_secrets.has(secret_key)) {
            res[secret_key] = secret_value;
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
    const url_path = `(${interface_ref}.path ? ${interface_ref}.path : '')`;
    return `\${{ ${url_protocol} + ${interface_ref}.host + ${url_port} + ${url_path} }}`;
  }

  findClosestComponent(component_configs: ComponentSpec[], date: Date): ComponentSpec | undefined {
    if (component_configs.length === 0) {
      return;
    }
    if (component_configs.length === 1) {
      return component_configs[0];
    }

    const target_time = date.getTime();

    let res;
    let best_diff = Number.NEGATIVE_INFINITY;
    for (const component_config of component_configs) {
      if (!component_config.metadata) {
        throw new Error(`Metadata has not been set on component`);
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

  getDependencyComponents(component_spec: ComponentSpec, component_specs: ComponentSpec[]): Dictionary<ComponentSpec> {
    const component_map: Dictionary<ComponentSpec[]> = {};
    for (const component_spec of component_specs) {
      const ref = component_spec.metadata.ref;
      if (!component_map[ref]) {
        component_map[ref] = [];
      }
      // Potentially multiple components with the same ref and different instance ids
      component_map[ref].push(component_spec);
    }

    const dependency_components: Dictionary<ComponentSpec> = {};
    for (const dep_name of Object.keys(component_spec.dependencies || {})) {
      const dep_ref = this.getComponentRef(dep_name);
      if (!component_map[dep_ref]) {
        continue;
      }
      const dep_components = component_map[dep_ref];
      if (!component_spec.metadata) {
        throw new Error(`Metadata has not been set on component`);
      }
      const dep_component = this.findClosestComponent(dep_components, component_spec.metadata.instance_date);
      if (!dep_component) {
        continue;
      }
      dependency_components[dep_name] = dep_component;
    }
    return dependency_components;
  }

  validateRequiredSecrets(component: ComponentConfig, secrets: Dictionary<SecretValue>): void { // TODO: 404: update
    const validation_errors = [];
    // Check required parameters and secrets for components
    for (const [key, value] of Object.entries(component.secrets)) {
      if (value.required !== false && secrets[key] === undefined) {
        const validation_error = new ValidationError({
          component: component.name,
          path: `secrets.${key}`,
          message: `required secret '${key}' was not provided`,
          value: value.default,
        });
        validation_errors.push(validation_error);
      }
    }
    if (validation_errors.length > 0) {
      throw new ValidationErrors(validation_errors, component.metadata.file);
    }
  }

  validateGraph(graph: DependencyGraph): void {
    // Check for duplicate subdomains
    const seen_subdomains: Dictionary<string[]> = {};
    for (const ingress_edge of graph.edges.filter((edge) => edge instanceof IngressEdge)) {
      const service_node = graph.getNodeByRef(ingress_edge.to) as ServiceNode;
      const interface_spec = service_node.config.interfaces[ingress_edge.interface_to];

      if (!interface_spec.ingress) {
        continue;
      }
      const ingress = interface_spec.ingress;
      const subdomain = ingress.subdomain || ingress_edge.interface_to;

      if (ingress.subdomain && interface_spec.protocol && !this.valid_protocols.has(interface_spec.protocol)) {
        throw new ArchitectError(`Protocol '${interface_spec.protocol}' is detected in '${ingress_edge.interface_to}'. We currently only support 'http' and 'https' protocols.`);
      }

      const key = ingress?.path ? `${subdomain} with path ${ingress.path}` : subdomain;
      if (!seen_subdomains[key]) {
        seen_subdomains[key] = [];
      }
      seen_subdomains[key].push(`${service_node.ref}.${ingress_edge.interface_to}`);
    }

    for (const [subdomain, values] of Object.entries(seen_subdomains)) {
      if (values.length > 1) {
        throw new ArchitectError(`The subdomain ${subdomain} is claimed by multiple component interfaces:\n[${values.sort().join(', ')}]\nPlease set interfaces.<name>.ingress.subdomain=<subdomain> or interfaces.<name>.ingress.path=<path> to avoid conflicts.`);
      }
    }
  }

  validateReservedNodeNames(all_nodes: DependencyNode[]): void {
    const seen_nodes: DependencyNode[] = [];
    for (const node of all_nodes.filter(n => n instanceof ServiceNode || n instanceof TaskNode)) {
      if (seen_nodes.some(n => Boolean(node.instance_id) && Boolean(n.instance_id) && n.ref === node.ref && n.instance_id !== node.instance_id)) {
        throw new Error(`A service named ${node.ref} is declared in multiple places. The same name can't be used for multiple services.`);
      }
      seen_nodes.push(node);
    }
  }

  abstract getArchitectContext(): ArchitectContext;

  async getComponentSpecContext(graph: DependencyGraph, component_spec: ComponentSpec, all_secrets: SecretsDict, options: GraphOptions): Promise<{ component_spec: ComponentSpec, context: ComponentContext }> {
    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    let context: ComponentContext = {
      name: component_spec.name,
      architect: this.getArchitectContext(),
      environment: {
        ingresses: {},
      },
      dependencies: {},
      ingresses: {},
      interfaces: {},
      outputs: {},
      parameters: {},
      secrets: {},
      services: {},
      tasks: {},
    };

    const parameters = transformDictionary(transformSecretDefinitionSpec, component_spec.parameters); // TODO: 404: remove
    const component_spec_secrets = transformDictionary(transformSecretDefinitionSpec, component_spec.secrets);
    for (const [key, value] of [...Object.entries(parameters), ...Object.entries(component_spec_secrets)]) {
      context.secrets[key] = value.default;
    }

    const secrets = this.getSecretsForComponentSpec(component_spec, all_secrets);
    context.secrets = {
      ...context.secrets,
      ...secrets,
    };
    context.parameters = context.secrets; // TODO: 404: remove

    if (options.interpolate) {
      // Interpolate secrets
      context = interpolateObject(context, context, { keys: false, values: true, file: component_spec.metadata.file });

      // Replace conditionals
      component_spec = interpolateObject(component_spec, context, { keys: true, values: false, file: component_spec.metadata.file });
    }

    const component_config = transformComponentSpec(component_spec);

    if (options.interpolate && options.validate) {
      this.validateRequiredSecrets(component_config, context.secrets || {});
    }

    const nodes = this.getComponentNodes(component_config);
    if (options.validate) {
      this.validateReservedNodeNames([...nodes, ...graph.nodes]);
    }

    for (const node of nodes) {
      node.instance_id = component_config.metadata?.instance_id || '';
      graph.addNode(node);
    }

    // Generate remaining context except ingress.x.consumers and dependencies
    for (const [key, value] of Object.entries(component_config.outputs)) {
      context.outputs[key] = value.value;
    }
    const [external_host, external_port_string] = this.external_addr.split(':');
    const external_port = Number.parseInt(external_port_string);
    const external_protocol = this.use_ssl ? 'https' : 'http';
    for (const [service_name, service] of Object.entries(component_config.services)) {
      if (!context.services[service_name]) {
        context.services[service_name] = {
          interfaces: {},
          environment: {},
        };
      }
      const service_ref = buildNodeRef(component_config, 'services', service_name);
      for (const [interface_name, interface_config] of Object.entries(service.interfaces)) {
        const interface_ref = `services.${service_name}.interfaces.${interface_name}`;

        const architect_host = service_ref;
        const architect_port = `${interface_ref}.external_port`;
        context.services[service_name].interfaces[interface_name] = {
          protocol: 'http',
          username: '',
          password: '',
          path: '',
          ...interface_config,
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          external_port: interface_config.port,
          external_host: interface_config.host,
          // Return different value for port when a service is refing its own port value
          port: `\${{ ${interface_ref}.external_host || startsWith(_path, 'services.${service_name}.') ? ${interface_ref}.external_port : ${architect_port} }}`,
          host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : '${architect_host}' }}`,
          url: this.generateUrl(interface_ref),
        };

        // TODO:TJ set context for services.<name>.interfaces.<name>.ingress.url

        // Set ingresses
        // TODO:TJ only set for old interfaces
        const deprecated_interface_name = interface_name;
        if (deprecated_interface_name) {
          // Deprecated: context.interfaces
          context.interfaces[deprecated_interface_name] = {
            host: interface_config.host || `\${{ ${interface_ref}.host }}`,
            port: interface_config.port || `\${{ ${interface_ref}.port }}`,
            username: interface_config.username || `\${{ ${interface_ref}.username }}`,
            password: interface_config.password || `\${{ ${interface_ref}.password }}`,
            protocol: interface_config.protocol || `\${{ ${interface_ref}.protocol }}`,
            url: interface_config.url || `\${{ ${interface_ref}.url }}`,
          };

          // Deprecated: context.ingresses
          const ingress_ref = `ingresses.${deprecated_interface_name}`;
          context.ingresses[deprecated_interface_name] = {
            dns_zone: external_host,
            subdomain: interface_config.ingress?.subdomain || deprecated_interface_name,
            host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : ((${ingress_ref}.subdomain == '@' ? '' : ${ingress_ref}.subdomain + '.') + ${ingress_ref}.dns_zone) }}`,
            port: `\${{ ${interface_ref}.external_host ? ${interface_ref}.port : ${external_port} }}`,
            protocol: `\${{ ${interface_ref}.external_host ? ${interface_ref}.protocol : '${external_protocol}' }}`,
            username: '',
            password: '',
            path: interface_config.ingress?.path,
            url: this.generateUrl(ingress_ref),
            consumers: [],
          };

          // Deprecated: environment.ingresses
          if (!context.environment.ingresses[component_spec.name]) {
            context.environment.ingresses[component_spec.name] = {};
          }
          context.environment.ingresses[component_spec.name][deprecated_interface_name] = context.ingresses[deprecated_interface_name];
        }
      }
    }
    return { component_spec, context };
  }

  async getGraph(component_specs: ComponentSpec[], all_secrets: SecretsDict = {}, options?: GraphOptions): Promise<DependencyGraph> {
    options = {

      interpolate: true,
      validate: true,
      ...options,
    };

    if (options.validate) {
      SecretsConfig.validate(all_secrets);
    }

    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    const graph = new DependencyGraphMutable();

    const context_map: Dictionary<ComponentContext> = {};
    const dependency_context_map: Dictionary<ComponentContext> = {};

    const evaluated_component_specs: ComponentSpec[] = [];
    for (const raw_component_spec of component_specs) {
      const { component_spec, context } = await this.getComponentSpecContext(graph, raw_component_spec, all_secrets, options);

      if (options.interpolate) {
        // Interpolate interfaces/ingresses/services for dependencies
        dependency_context_map[component_spec.metadata.ref] = interpolateObject(context, context, { keys: false, values: true, file: component_spec.metadata.file });
      } else {
        dependency_context_map[component_spec.metadata.ref] = context;
      }

      context_map[component_spec.metadata.ref] = context;
      evaluated_component_specs.push(component_spec);
    }

    // Add edges to graph
    for (const component_spec of evaluated_component_specs) {
      const component_config = transformComponentSpec(component_spec);
      const dependency_specs = this.getDependencyComponents(component_spec, component_specs);
      const dependency_configs = Object.values(dependency_specs).map(d => transformComponentSpec(d));
      this.addComponentEdges(graph, component_config, dependency_configs, dependency_context_map);

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
        if (!context.services[service_name]) {
          context.services[service_name] = {
            interfaces: {},
            environment: {},
          };
        }
        context.services[service_name].environment = service.environment;
      }

      for (const [task_name, task] of Object.entries(component_spec.tasks || {})) {
        if (!context.tasks[task_name]) {
          context.tasks[task_name] = {};
        }
        context.tasks[task_name].environment = task.environment;
      }

      const dependency_specs = this.getDependencyComponents(component_spec, component_specs);
      context.dependencies = {};
      for (const [dep_name, dependency_spec] of Object.entries(dependency_specs)) {
        const dependency_context = dependency_context_map[dependency_spec.metadata.ref];
        context.dependencies[dep_name] = {
          ingresses: dependency_context.ingresses || {},
          interfaces: dependency_context.interfaces || {},
          outputs: dependency_context.outputs || {},
        };

        // Deprecated: environment.ingresses
        if (!context.environment.ingresses[dep_name]) {
          context.environment.ingresses[dep_name] = {};
        }
        for (const [dep_ingress_name, dep_ingress] of Object.entries(context.dependencies[dep_name].ingresses)) {
          context.environment.ingresses[dep_name][dep_ingress_name] = dep_ingress;
        }
      }

      /* TODO:TJ
      const ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && edge.to.startsWith(`${component_spec.name}.`)) as IngressEdge[];
      // Set consumers context
      if (ingress_edge) {
        for (const [interface_name, consumer_refs] of Object.entries(ingress_edge.consumers_map)) {
          const interfaces_refs = new Set(graph.edges.filter(edge => consumer_refs.has(edge.to) && graph.getNodeByRef(edge.from) instanceof ComponentNode).map(edge => edge.from));
          const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && interfaces_refs.has(edge.to)) as IngressEdge[];
          const consumers = new Set<string>();
          for (const consumer_ingress_edge of consumer_ingress_edges) {
            const interface_node = graph.getNodeByRef(consumer_ingress_edge.to) as ComponentNode;
            const consumer_interface = dependency_context_map[interface_node.slug].ingresses || {};
            for (const { interface_to: consumer_interface_to } of consumer_ingress_edge.interface_mappings) {
              consumers.add(consumer_interface[consumer_interface_to].url);
            }
          }
          context.ingresses[interface_name].consumers = [...consumers].sort();
        }
      }
      */

      if (options.interpolate) {
        component_spec = interpolateObject(component_spec, context, { keys: false, values: true, file: component_spec.metadata.file });
      }

      if (options.validate) {
        component_spec.metadata.interpolated = true;
        validateOrRejectSpec(classToPlain(plainToClass(ComponentSpec, component_spec)), component_spec.metadata);
      }

      const component_config = transformComponentSpec(component_spec);

      const services = Object.entries(component_config.services).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'services' as ResourceType, resource_config }));
      const tasks = Object.entries(component_config.tasks).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'tasks' as ResourceType, resource_config }));
      for (const { resource_config, resource_type } of [...services, ...tasks]) {
        const resource_ref = buildNodeRef(component_config, resource_type, resource_config.name);
        const node = graph.getNodeByRef(resource_ref) as ServiceNode | TaskNode;
        node.config = resource_config;
      }
    }

    if (options.validate) {
      this.validateGraph(graph);
      graph.validated = true;
    }

    return Object.freeze(graph);
  }
}
