import { classToPlain, plainToClass, serialize } from 'class-transformer';
import { isMatch } from 'matcher';
import { buildNodeRef, ComponentConfig } from './config/component-config';
import { ArchitectContext, ComponentContext, SecretValue } from './config/component-context';
import { DeprecatedInterfacesSpec } from './deprecated-spec/interfaces';
import { DependencyGraph, DependencyGraphMutable } from './graph';
import { IngressEdge } from './graph/edge/ingress';
import { IngressConsumerEdge } from './graph/edge/ingress-consumer';
import { ServiceEdge } from './graph/edge/service';
import { DependencyNode } from './graph/node';
import { GatewayNode } from './graph/node/gateway';
import { ServiceNode } from './graph/node/service';
import { TaskNode } from './graph/node/task';
import { GraphOptions } from './graph/type';
import { SecretsConfig } from './secrets/secrets';
import { SecretsDict } from './secrets/type';
import { ComponentSpec, SecretDefinitionSpec } from './spec/component-spec';
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
        component_ref: component.metadata.ref,
        service_name,
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

  getGatewayNode(): GatewayNode {
    const gateway_host = this.external_addr.split(':')[0];
    const gateway_port = Number.parseInt(this.external_addr.split(':')[1] || '443');
    const gateway_node = new GatewayNode(gateway_host, gateway_port);
    gateway_node.instance_id = gateway_node.ref;
    return gateway_node;
  }

  addIngressEdges(graph: DependencyGraph, component_config: ComponentConfig): void {
    for (const [service_name, service] of Object.entries(component_config.services)) {
      for (const [interface_name, interface_spec] of Object.entries(service.interfaces)) {
        if (interface_spec.ingress?.enabled || interface_spec.ingress?.subdomain) {
          const gateway_node = this.getGatewayNode();
          graph.addNode(gateway_node);

          const ingress_edge = new IngressEdge(gateway_node.ref, buildNodeRef(component_config, 'services', service_name), interface_name);
          graph.addEdge(ingress_edge);
        }
      }
    }
  }

  addComponentEdges(graph: DependencyGraph, component_config: ComponentConfig, component_configs: ComponentConfig[]): void {
    const component = component_config;

    this.addIngressEdges(graph, component_config);

    // Add edges FROM services to other services
    const services = Object.entries(component_config.services).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'services' as ResourceType, resource_config }));
    const tasks = Object.entries(component_config.tasks).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'tasks' as ResourceType, resource_config }));
    for (const { resource_config, resource_name, resource_type } of [...services, ...tasks]) {
      const from = buildNodeRef(component, resource_type, resource_name);

      const resource_string = replaceInterpolationBrackets(serialize(resource_config, { excludePrefixes: ['metadata'] }));
      let matches;

      // Add edges between services
      const services_regex = new RegExp(`\\\${{\\s*(dependencies\\.(?<dependency_name>${ComponentSlugUtils.RegexBase})\\.)?services\\.(?<service_name>${Slugs.ArchitectSlugRegexBase})\\.interfaces\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.(?<interface_key>${Slugs.ArchitectSlugRegexBase})`, 'g');
      while ((matches = services_regex.exec(resource_string)) !== null) {
        if (!matches.groups) {
          continue;
        }
        const { dependency_name, service_name, interface_name, interface_key } = matches.groups;

        const dependency = component_configs.find(c => c.name === dependency_name) || component;

        const to = buildNodeRef(dependency, 'services', service_name);

        if (to === from) continue;

        if (!graph.nodes_map.has(to)) continue;

        if (interface_key === 'ingress') {
          const edge = new IngressConsumerEdge(from, to, interface_name);
          graph.addEdge(edge);
        } else {
          const edge = new ServiceEdge(from, to, interface_name);
          graph.addEdge(edge);
        }
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

  validateRequiredSecrets(component: ComponentConfig, secrets: Dictionary<SecretValue>): void { // TODO: 404: update
    const validation_errors = [];
    // Check required parameters and secrets for components
    for (const [key, value] of Object.entries(component.secrets)) {
      if (value.required !== false && secrets[key] === undefined && !value.default) {
        const validation_error = new ValidationError({
          component: component.name,
          path: `secrets.${key}`,
          message: `required secret '${key}' was not provided`,
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
        throw new ArchitectError(`Protocol '${interface_spec.protocol}' is detected in '${service_node.config.metadata.ref}.interfaces.${ingress_edge.interface_to}'. We currently only support 'http' and 'https' protocols.`);
      }

      const key = ingress?.path ? `${subdomain} with path ${ingress.path}` : subdomain;
      if (!seen_subdomains[key]) {
        seen_subdomains[key] = [];
      }
      seen_subdomains[key].push(`${service_node.config.metadata.ref}.interfaces.${ingress_edge.interface_to}`);
    }
    for (const [subdomain, values] of Object.entries(seen_subdomains)) {
      if (values.length > 1) {
        const msg = `The subdomain ${subdomain} is claimed by multiple component interfaces:
          \n[${values.sort().join(', ')}]
          \nPlease set services.<name>.interfaces.<name>.ingress.subdomain=<subdomain> or services.<name>.interfaces.<name>.ingress.path=<path> to avoid conflicts.`;
        throw new ArchitectError(msg);
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

  protected getConsumers(graph: DependencyGraph, context_map: Dictionary<ComponentContext>, current_node: ServiceNode, interface_name: string): string[] {
    const service_nodes = graph.nodes.filter(node => node instanceof ServiceNode && node.component_ref === current_node.component_ref) as ServiceNode[];
    const to = current_node.ref;

    const consumer_edges = graph.edges.filter(edge => edge instanceof IngressConsumerEdge && edge.to === to && edge.interface_to === interface_name);
    const consumer_node_refs = new Set(consumer_edges.map(edge => edge.from));
    const consumer_nodes = [...consumer_node_refs].map(node_ref => graph.getNodeByRef(node_ref)).filter(node => node instanceof ServiceNode) as ServiceNode[];

    const consumers = new Set<string>();
    for (const consumer_node of [...consumer_nodes, ...service_nodes]) {
      const consumer_context = context_map[consumer_node.component_ref];
      const consumer_ingress_edges = graph.edges.filter(edge => edge instanceof IngressEdge && edge.to === consumer_node.ref);
      const consumer_interface_names = consumer_ingress_edges.map(edge => edge.interface_to);
      for (const consumer_interface_name of consumer_interface_names) {
        const consumer_url = consumer_context.services[consumer_node.service_name].interfaces[consumer_interface_name].ingress?.url;
        if (consumer_url) {
          consumers.add(consumer_url);
        }
      }
    }
    return [...consumers].sort();
  }

  async getComponentSpecContext(graph: DependencyGraph, component_spec: ComponentSpec, all_secrets: SecretsDict, options: GraphOptions): Promise<{ component_spec: ComponentSpec, context: ComponentContext }> {
    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    let context: ComponentContext = {
      name: component_spec.name,
      architect: this.getArchitectContext(),
      dependencies: {},
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
          external_host: interface_config.host || '',
          // Return different value for port when a service is refing its own port value
          port: `\${{ ${interface_ref}.external_host || startsWith(_path, 'services.${service_name}.') ? ${interface_ref}.external_port : ${architect_port} }}`,
          host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : '${architect_host}' }}`,
          url: this.generateUrl(interface_ref),
        };

        const ingress_ref = `${interface_ref}.ingress`;
        const subdomain = interface_config.ingress?.subdomain || interface_name;
        context.services[service_name].interfaces[interface_name].ingress = {
          dns_zone: external_host,
          subdomain: subdomain || interface_name,
          host: `\${{ ${interface_ref}.external_host ? ${interface_ref}.external_host : ((${ingress_ref}.subdomain == '@' ? '' : ${ingress_ref}.subdomain + '.') + ${ingress_ref}.dns_zone) }}`,
          port: `\${{ ${interface_ref}.external_host ? ${interface_ref}.port : ${external_port} }}`,
          protocol: `\${{ ${interface_ref}.external_host ? ${interface_ref}.protocol : '${external_protocol}' }}`,
          username: '',
          password: '',
          path: interface_config.ingress?.path,
          url: this.generateUrl(ingress_ref),
          consumers: [],
        };
      }
    }
    return { component_spec, context };
  }

  validateServiceEnvironments(component_specs: ComponentSpec[], secrets: SecretsDict): void { // TODO: remove?
    for (const component_spec of component_specs) {
      const validation_errors: ValidationError[] = [];
      for (const [service_name, service_spec] of Object.entries(component_spec.services || {})) {
        for (const [env_var_key, env_var_value] of Object.entries(service_spec.environment || {})) {
          if (component_spec.services) {
            const service_environment = component_spec.services[service_name].environment;
            if (!service_environment) {
              continue;
            }

            if (typeof env_var_value === 'object' && env_var_value) {
              const secret_definition_spec = env_var_value as SecretDefinitionSpec;

              if (secret_definition_spec.required !== false && !secret_definition_spec.default) {
                // TODO: if secret is also defined in the same way at the top level of the spec, ignore and continue?
                const all_components_secret_exists = secrets['*'] && secrets['*'][env_var_key] !== undefined; // TODO: should this also match with the account included?
                const component_secret_exists = secrets[component_spec.name] && secrets[component_spec.name][env_var_key] !== undefined; // TODO: should this also match with the account included?

                if (!all_components_secret_exists && !component_secret_exists) {
                  const validation_error = new ValidationError({
                    component: component_spec.name,
                    path: `services.${service_name}.environment.${env_var_key}`,
                    message: `required service-level secret '${env_var_key}' was not provided`,
                  });
                  validation_errors.push(validation_error);
                }
              }
            }
          }
        }
      }
      if (validation_errors.length > 0) {
        throw new ValidationErrors(validation_errors, component_spec.metadata.file);
      }
    }
  }

  async getGraph(component_specs: ComponentSpec[], all_secrets: SecretsDict = {}, options?: GraphOptions): Promise<DependencyGraph> {
    options = {
      interpolate: true,
      validate: true,
      ...options,
    };

    if (options.validate) {
      SecretsConfig.validate(all_secrets);
      this.validateServiceEnvironments(component_specs, all_secrets);
    }

    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    const graph = new DependencyGraphMutable();

    const context_map: Dictionary<ComponentContext> = {};

// TODO: validate new service-level environment block format

    for (const component_spec of component_specs) { // TODO: rather than modifying the object, tack on a dummy object, then merge into to the original one?
      for (const [service_name, service_spec] of Object.entries(component_spec.services || {})) { // TODO: also modify task environments?
        for (const [env_var_key, env_var_value] of Object.entries(service_spec.environment || {})) {
          if (component_spec.services) {
            const service_environment = component_spec.services[service_name].environment;
            if (!service_environment) {
              continue;
            }

            if (['string', 'number', 'boolean'].includes(typeof env_var_value)) {
              service_environment[env_var_key] = `${env_var_value}`;
            } else if (env_var_value && typeof env_var_value === 'object' && (env_var_value as SecretDefinitionSpec).default) { // TODO: check instanceof SecretDefinitionSpec?
              const secret_definition_spec = env_var_value as SecretDefinitionSpec;
              service_environment[env_var_key] = !!secret_definition_spec.default ? secret_definition_spec.default : null;
            } else {
              if (all_secrets[component_spec.name] && all_secrets[component_spec.name][env_var_key]) { // TODO: should this also match with the account included?
                service_environment[env_var_key] = all_secrets[component_spec.name][env_var_key]; // TODO: should this also match with the account included?
              } else if (all_secrets['*'] && all_secrets['*'][env_var_key]) {
                service_environment[env_var_key] = all_secrets['*'][env_var_key];
              } else if (env_var_value && typeof env_var_value === 'object' && (env_var_value as SecretDefinitionSpec).required === false) {
                service_environment[env_var_key] = null; // no matching secret passed in, environment variable optional
              }
              // TODO: else error?
            }
          }
        }
      }
    }

    // TODO: remove
    // architect dev examples/hello-world/architect.yml -e test -s world_text_5=FIVE -s WORLD_TEXT=ONE -s WORLD_TEXT_4=something -s WORLD_TEXT_3=another-one
    // architect dev examples/hello-world/architect.yml -e test -s world_text_5=FIVE -s WORLD_TEXT_4=something -s WORLD_TEXT_3=another-one --secret-file=test-secrets.yml

    const evaluated_component_specs: ComponentSpec[] = [];
    for (const raw_component_spec of component_specs) {
      const { component_spec, context } = await this.getComponentSpecContext(graph, raw_component_spec, all_secrets, options);

      if (options.interpolate) {
        // Interpolate interfaces/ingresses/services for dependencies
        context_map[component_spec.metadata.ref] = interpolateObject(context, context, { keys: false, values: true, file: component_spec.metadata.file });
      } else {
        context_map[component_spec.metadata.ref] = context;
      }

      const parsed = ComponentVersionSlugUtils.parse(component_spec.metadata.ref);
      if (parsed.component_account_name && parsed.component_account_name === this.account) {
        const ref_without_account = ComponentSlugUtils.build(undefined, parsed.component_name, parsed.instance_name);
        // Hack to support optional account prefixes
        context_map[ref_without_account] = context_map[component_spec.metadata.ref];
      } else if (!parsed.component_account_name && this.account) {
        const ref_with_account = ComponentSlugUtils.build(this.account, parsed.component_name, parsed.instance_name);
        // Hack to support optional account prefixes
        context_map[ref_with_account] = context_map[component_spec.metadata.ref];
      }

      evaluated_component_specs.push(component_spec);
    }

    const component_configs = evaluated_component_specs.map((component_spec) => transformComponentSpec(component_spec));

    // Add edges to graph
    for (const component_config of component_configs) {
      this.addComponentEdges(graph, component_config, component_configs);
    }

    const deprecated_features = [new DeprecatedInterfacesSpec(this)];
    for (const deprecated_feature of deprecated_features) {
      if (deprecated_feature.shouldRun(component_configs)) {
        deprecated_feature.transformGraph(graph, component_configs);
      }
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

    if (options.interpolate) {
      // Generate context for dependencies/consumers
      for (const component_spec of evaluated_component_specs) {
        const context = context_map[component_spec.metadata.ref];

        for (const [service_name, service] of Object.entries(component_spec.services || {})) {
          if (!context.services[service_name]) {
            context.services[service_name] = {
              interfaces: {},
              environment: {},
            };
          }
          context.services[service_name].environment = service.environment;

          const to = buildNodeRef(component_spec, 'services', service_name);
          const current_node = graph.getNodeByRef(to) as ServiceNode;
          // Generate consumers context
          for (const interface_name of Object.keys(service.interfaces || {})) {
            const ingress = context.services[service_name].interfaces[interface_name].ingress;
            if (!ingress) {
              continue;
            }
            ingress.consumers = this.getConsumers(graph, context_map, current_node, interface_name);
          }
        }

        for (const [task_name, task] of Object.entries(component_spec.tasks || {})) {
          if (!context.tasks[task_name]) {
            context.tasks[task_name] = {};
          }
          context.tasks[task_name].environment = task.environment;
        }

        context.dependencies = {};
        for (const dep_name of Object.keys(component_spec.dependencies || {})) {
          const dependency_context = context_map[dep_name];
          if (!dependency_context) continue;

          context.dependencies[dep_name] = {
            services: dependency_context.services || {},
            outputs: dependency_context.outputs || {},
          };
        }
      }

      for (const deprecated_feature of deprecated_features) {
        if (deprecated_feature.shouldRun(component_configs)) {
          deprecated_feature.transformContext(component_configs, context_map);
        }
      }
    }

    for (let component_spec of evaluated_component_specs) {
      const context = context_map[component_spec.metadata.ref];

      if (options.interpolate) {
        component_spec = interpolateObject(component_spec, context, { keys: false, values: true, file: component_spec.metadata.file });
      }

      if (options.validate) {
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
