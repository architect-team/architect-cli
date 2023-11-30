import { instanceToPlain, plainToInstance, serialize } from 'class-transformer';
import { buildNodeRef, ComponentConfig } from './config/component-config';
import { ArchitectContext, ComponentContext, DatabaseContext, ServiceContext } from './config/component-context';
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
import { Secrets } from './secrets/secrets';
import { SecretsDict } from './secrets/type';
import { ComponentSpec } from './spec/component-spec';
import { transformComponentSpec, transformSecretDefinitionSpec } from './spec/transform/component-transform';
import { transformResourceSpecEnvironment } from './spec/transform/resource-transform';
import { ComponentSlugUtils, ComponentVersionSlugUtils, ResourceType, Slugs } from './spec/utils/slugs';
import { validateOrRejectSpec } from './spec/utils/spec-validator';
import { Dictionary, transformDictionary } from './utils/dictionary';
import { ArchitectError } from './utils/errors';
import { interpolateObjectLoose, interpolateObjectOrReject, replaceInterpolationBrackets } from './utils/interpolation';
import { IngressConfig, ServiceConfig, ServiceInterfaceConfig } from './config/service-config';
import { SecretDefinitionSpec, SecretSpecValue } from './spec/secret-spec';

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
        local_path: component.metadata.file?.folder,
        artifact_image: component.artifact_image,
      });
      nodes.push(node);
    }

    // Load component tasks
    for (const [task_name, task_config] of Object.entries(component.tasks)) {
      const node = new TaskNode({
        ref: buildNodeRef(component, 'tasks', task_name),
        config: task_config,
        local_path: component.metadata.file?.folder,
      });
      nodes.push(node);
    }

    return nodes;
  }

  getComponentRef(component_string: string): string {
    const { component_name, instance_name } = ComponentVersionSlugUtils.parse(component_string);
    const component_ref = ComponentSlugUtils.build(component_name, instance_name);
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

      const database_regex = new RegExp(`\\\${{\\s*(dependencies\\.(?<dependency_name>${ComponentSlugUtils.RegexBase})\\.)?databases\\.(?<database_name>${Slugs.ArchitectSlugRegexBase})\\.(?<database_key>${Slugs.ArchitectSlugRegexBase})`, 'g');
      while ((matches = database_regex.exec(resource_string)) !== null) {
        if (!matches.groups) continue;

        const { dependency_name, database_name } = matches.groups;

        const dependency = component_configs.find(c => c.name === dependency_name) || component;

        const to = buildNodeRef(dependency, 'databases', database_name);

        if (to === from) continue;

        if (!graph.nodes_map.has(to)) continue;

        const edge = new ServiceEdge(from, to, 'main');
        graph.addEdge(edge);
      }
    }
  }

  generateUrl(interface_ref: string): string {
    const url_auth = `(${interface_ref}.password ? (${interface_ref}.username + ':' + ${interface_ref}.password + '@') : '')`;
    const url_protocol = `(${interface_ref}.protocol == 'grpc' ? '' : (${interface_ref}.protocol + '://' + ${url_auth}))`;
    const url_port = `((${interface_ref}.port == 80 || ${interface_ref}.port == 443) ? '' : ':' + ${interface_ref}.port)`;
    const url_path = `(${interface_ref}.path ? ${interface_ref}.path : '')`;
    return `\${{ ${url_protocol} + ${interface_ref}.host + ${url_port} + ${url_path} }}`;
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
        const msg = `The component you are trying to deploy has the subdomain ${subdomain} that is claimed by multiple component interfaces:
          \n[${values.sort().join(', ')}].
          \nTo resolve this issue, either change the subdomain in the architect.yml file for this component, or clear the environment before trying to deploy this component.`;
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

  private getDatabaseContextFromConnectionString(connection_string: string, default_context: DatabaseContext): DatabaseContext {
    try {
      const url = new URL(connection_string);
      return {
        host: url.host,
        port: url.port,
        username: url.username,
        password: url.password,
        protocol: url.protocol,
        database: url.pathname,
        connection_string: connection_string,
        url: connection_string,
      };
    } catch {
      const regex = /^(\${{)|(}})+/gm;
      const raw_connection_string = connection_string.replace(regex, '');
      const raw_default_connection_string = default_context.connection_string.replace(regex, '');
      return {
        host: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'host') : '${default_context.host}' }}`,
        port: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'port') : '${default_context.port}' }}`,
        username: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'username') : '${default_context.username}' }}`,
        password: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'password') : '${default_context.password}' }}`,
        protocol: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'protocol') : '${default_context.protocol}' }}`,
        database: `\${{ ${raw_connection_string} ? parseUrl(${raw_connection_string}, 'pathname') : '${default_context.database}' }}`,
        connection_string: `\${{ (${raw_connection_string}) ? (${raw_connection_string}) : (${raw_default_connection_string}) }}`,
        url: `\${{ (${raw_connection_string}) ? (${raw_connection_string}) : (${raw_default_connection_string}) }}`,
      };
    }
  }

  async getComponentSpecContext(graph: DependencyGraph, component_spec: ComponentSpec, secrets: Secrets, options: GraphOptions): Promise<{ component_spec: ComponentSpec, context: ComponentContext }> {
    // Remove debug blocks
    for (const service_name of Object.keys(component_spec.services || {})) {
      delete component_spec.services![service_name].debug;
    }
    for (const task_name of Object.keys(component_spec.tasks || {})) {
      delete component_spec.tasks![task_name].debug;
    }

    // Remove optional services that are disabled
    for (const [service_name, service_spec] of Object.entries(component_spec.services || {})) {
      if (service_spec.enabled !== undefined && !service_spec.enabled) {
        delete component_spec.services![service_name];
      }
    }

    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    let context: ComponentContext = {
      name: component_spec.name,
      architect: this.getArchitectContext(),
      dependencies: {},
      outputs: {},
      secrets: {},
      databases: {},
      services: {},
      tasks: {},
    };

    const component_spec_secrets = transformDictionary(transformSecretDefinitionSpec, component_spec.secrets);
    for (const [key, value] of Object.entries(component_spec_secrets)) {
      context.secrets[key] = value.default;
    }

    const secrets_dict = secrets.getSecretsForComponentSpec(component_spec);
    context.secrets = {
      ...context.secrets,
      ...secrets_dict,
    };

    if (options.interpolate && options.validate) {
      secrets.validateComponentSpec(component_spec);
    }

    if (options.interpolate) {
      // Interpolate secrets
      context = interpolateObject(context, context, { keys: false, values: true, file: component_spec.metadata.file });

      // Replace conditionals
      component_spec = interpolateObject(component_spec, context, { keys: true, values: false, file: component_spec.metadata.file });
    }

    const component_config = transformComponentSpec(component_spec);
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

        const default_database_config = {
          host: interface_config.host || architect_host,
          port: interface_config.port as number,
          username: interface_config.username!,
          password: interface_config.password!,
          protocol: interface_config.protocol!,
          database: interface_config.path?.replace(/^\/+/, '') || '',
          connection_string: this.generateUrl(interface_ref),
          url: this.generateUrl(interface_ref),
        };
        if (service_name.endsWith(Slugs.DB_SUFFIX)) {
          const database_name = service_name.substring(0, service_name.length - Slugs.DB_SUFFIX.length);
          if (component_config.databases[database_name]) {
            context.databases[database_name] = component_config.databases[database_name].connection_string ?
              this.getDatabaseContextFromConnectionString(component_config.databases[database_name].connection_string || '', default_database_config) :
              default_database_config;
          }
        }

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
          private: interface_config.ingress?.private || false,
        };
      }
    }

    return { component_spec, context };
  }

  async getGraph(component_specs: ComponentSpec[], all_secrets: SecretsDict = {}, options?: GraphOptions): Promise<DependencyGraph> {
    options = {
      interpolate: true,
      validate: true,
      relax_validation: false,
      ...options,
    };

    const secrets = new Secrets(all_secrets, this.account);

    if (options.validate) {
      secrets.validate();
    }

    const interpolateObject = options.validate ? interpolateObjectOrReject : interpolateObjectLoose;

    const graph = new DependencyGraphMutable();

    const context_map: Dictionary<ComponentContext> = {};

    const evaluated_component_specs: ComponentSpec[] = [];
    for (const raw_component_spec of component_specs) {
      if (options.relax_validation && raw_component_spec.secrets) {
        // Assign dummy value to unset secrets
        for (const [key, secret] of Object.entries(raw_component_spec.secrets as Dictionary<SecretSpecValue | SecretDefinitionSpec>)) {
          if (!secret) {
            raw_component_spec.secrets[key] = { default: '-999' };
          }
        }
      }
      const { component_spec, context } = await this.getComponentSpecContext(graph, raw_component_spec, secrets, options);

      if (options.interpolate) {
        // Interpolate interfaces/ingresses/services for dependencies
        context_map[component_spec.metadata.ref] = interpolateObject(context, context, { keys: false, values: true, file: component_spec.metadata.file });
      } else {
        context_map[component_spec.metadata.ref] = context;
      }

      // Hack to support optional account prefixes in dependency name
      context_map[`${this.account}/${component_spec.metadata.ref}`] = context_map[component_spec.metadata.ref];
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
          context.services[service_name].environment = transformResourceSpecEnvironment(service.environment);

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
          context.tasks[task_name].environment = transformResourceSpecEnvironment(task.environment);
        }

        context.dependencies = {};
        for (const dep_name of Object.keys(component_spec.dependencies || {})) {
          const dependency_context = context_map[dep_name];
          if (!dependency_context && !options.relax_validation) {
            continue;
          }

          if (options.relax_validation) {
            // Mock dependency node for validation
            const mock_service_ingress_config: IngressConfig = {
              enabled: false,
              subdomain: '',
              path: '',
              ip_whitelist: [],
              sticky: '',
              private: false,
              consumers: [],
              dns_zone: '',
              host: '',
              port: '',
              protocol: '',
              username: '',
              password: '',
              url: '',
            };
            const mock_service_interface_config: ServiceInterfaceConfig = {
              host: '',
              port: '',
              protocol: '',
              username: '',
              password: '',
              url: '',
              sticky: '',
              path: '',
              ingress: mock_service_ingress_config,
            };
            const mock_dependency_node = {
              __type: '',
              config: {} as ServiceConfig,
              ref: `${dep_name}--ø`,
              component_ref: dep_name,
              service_name: 'ø',
              interfaces: { 'ø': mock_service_interface_config },
              ingresses: { 'ø': mock_service_ingress_config },
              ports: [],
              is_external: false,
              instance_id: '',
            };
            graph.addNode(mock_dependency_node);

            const service_context: ServiceContext = {
              environment: {},
              interfaces: { 'ø': mock_service_interface_config },
            };
            context.dependencies[dep_name] = {
              services: { 'ø': service_context },
              outputs: {},
            };
          } else {
            context.dependencies[dep_name] = {
              services: dependency_context.services || {},
              outputs: dependency_context.outputs || {},
            };
          }
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
        component_spec = interpolateObject(component_spec, context, { keys: false, values: true, file: component_spec.metadata.file, relax_validation: options.relax_validation });
        component_spec.metadata.interpolated = true;
      }

      if (options.validate) {
        validateOrRejectSpec(instanceToPlain(plainToInstance(ComponentSpec, component_spec)), component_spec.metadata);
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
