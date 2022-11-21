import { serialize } from 'class-transformer';
import { DeprecatedSpec } from '.';
import { buildNodeRef, ComponentConfig } from '../config/component-config';
import { ComponentContext } from '../config/component-context';
import { DependencyGraph } from '../graph';
import { IngressEdge } from '../graph/edge/ingress';
import { IngressConsumerEdge } from '../graph/edge/ingress-consumer';
import { ServiceEdge } from '../graph/edge/service';
import { ComponentSlugUtils, ResourceType, Slugs } from '../spec/utils/slugs';
import { Dictionary } from '../utils/dictionary';
import { replaceInterpolationBrackets } from '../utils/interpolation';

export class DeprecatedInterfacesSpec extends DeprecatedSpec {
  public shouldRun(component_configs: ComponentConfig[]): boolean {
    return component_configs.some(component_config => Object.keys(component_config.metadata.deprecated_interfaces_map).length > 0);
  }

  public transformContext(component_configs: ComponentConfig[], context_map: Dictionary<ComponentContext>): void {
    for (const component_config of component_configs) {
      // TODO:TJ any
      const context = context_map[component_config.metadata.ref] as any;

      context.interfaces = {};
      context.ingresses = {};
      if (!context.environment) {
        context.environment = {};
      }
      context.environment.ingresses = {};

      for (const [deprecated_interface_name, service_name] of Object.entries(component_config.metadata.deprecated_interfaces_map) as [string, string][]) {
        const interface_context = context.services[service_name].interfaces[deprecated_interface_name];

        context.interfaces[deprecated_interface_name] = interface_context;
        context.ingresses[deprecated_interface_name] = interface_context.ingress;

        if (!context.environment.ingresses[component_config.name]) {
          context.environment.ingresses[component_config.name] = {};
        }
        context.environment.ingresses[component_config.name][deprecated_interface_name] = interface_context.ingress;
      }
    }

    for (const component_config of component_configs) {
      // TODO:TJ any
      const context = context_map[component_config.metadata.ref] as any;

      for (const dep_name of Object.keys(context.dependencies)) {
        const dependency_context = context_map[dep_name] as any;
        context.dependencies[dep_name].interfaces = dependency_context.interfaces || {};
        context.dependencies[dep_name].ingresses = dependency_context.ingresses || {};

        if (!context.environment.ingresses[dep_name]) {
          context.environment.ingresses[dep_name] = {};
        }
        for (const [interface_name, ingress_context] of Object.entries(context.dependencies[dep_name].ingresses)) {
          context.environment.ingresses[dep_name][interface_name] = ingress_context;
        }
      }
    }
  }

  public transformGraph(graph: DependencyGraph, component_configs: ComponentConfig[]): void {
    for (const component_config of component_configs) {
      const services = Object.entries(component_config.services).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'services' as ResourceType, resource_config }));
      const tasks = Object.entries(component_config.tasks).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'tasks' as ResourceType, resource_config }));
      for (const { resource_config, resource_name, resource_type } of [...services, ...tasks]) {
        const resource_string = replaceInterpolationBrackets(serialize(resource_config, { excludePrefixes: ['metadata'] }));
        const from = buildNodeRef(component_config, resource_type, resource_name);
        this.addEnvironmentIngresses(graph, component_configs, from, resource_string);
        this.addIngresses(graph, component_config, from, resource_string);
        this.addDependencyInterfacesIngresses(graph, component_configs, from, resource_string);
      }
    }
  }

  protected addEnvironmentIngresses(graph: DependencyGraph, component_configs: ComponentConfig[], from: string, resource_string: string): void {
    const environment_ingresses_regex = new RegExp(`\\\${{\\s*environment\\.ingresses\\.(?<dependency_name>${ComponentSlugUtils.RegexBase})\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.`, 'g');
    let matches;
    while ((matches = environment_ingresses_regex.exec(resource_string)) !== null) {
      if (!matches.groups) {
        continue;
      }
      const { dependency_name, interface_name } = matches.groups;
      const dep_ref = this.manager.getComponentRef(dependency_name);
      const dep_component_config = component_configs.find((component_config) => component_config.metadata.ref === dep_ref);

      if (!dep_component_config) {
        continue;
      }

      const dep_service_name = dep_component_config.metadata.deprecated_interfaces_map[interface_name];
      if (!dep_service_name) {
        continue;
      }

      const to = buildNodeRef(dep_component_config, 'services', dep_service_name);

      const gateway_node = this.manager.getGatewayNode();
      graph.addNode(gateway_node);

      const ingress_edge = new IngressEdge(gateway_node.ref, to, interface_name);
      graph.addEdge(ingress_edge);

      if (from !== to) {
        const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
        graph.addEdge(ingress_consumer_edge);
      }
    }
  }

  protected addIngresses(graph: DependencyGraph, component_config: ComponentConfig, from: string, resource_string: string): void {
    const ingresses_regex = new RegExp(`\\\${{\\s*ingresses\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.`, 'g');
    let matches;
    while ((matches = ingresses_regex.exec(resource_string)) !== null) {
      if (!matches.groups) {
        continue;
      }
      const { interface_name } = matches.groups;

      const dep_service_name = component_config.metadata.deprecated_interfaces_map[interface_name];
      if (!dep_service_name) {
        continue;
      }

      const to = buildNodeRef(component_config, 'services', dep_service_name);

      const gateway_node = this.manager.getGatewayNode();
      graph.addNode(gateway_node);

      const ingress_edge = new IngressEdge(gateway_node.ref, to, interface_name);
      graph.addEdge(ingress_edge);

      if (from !== to) {
        const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
        graph.addEdge(ingress_consumer_edge);
      }
    }
  }

  protected addDependencyInterfacesIngresses(graph: DependencyGraph, component_configs: ComponentConfig[], from: string, resource_string: string): void {
    const dep_interface_regex = new RegExp(`\\\${{\\s*dependencies\\.(?<dependency_name>${ComponentSlugUtils.RegexBase})\\.(?<interface_type>interfaces|ingresses)\\.(?<interface_name>${Slugs.ArchitectSlugRegexBase})\\.`, 'g');
    let matches;
    while ((matches = dep_interface_regex.exec(resource_string)) !== null) {
      if (!matches.groups) {
        continue;
      }
      const { dependency_name, interface_type, interface_name } = matches.groups;
      const dep_ref = this.manager.getComponentRef(dependency_name);

      const dependency = component_configs.find((component_config) => component_config.metadata.ref === dep_ref);
      if (!dependency) continue;

      const dep_service_name = dependency.metadata.deprecated_interfaces_map[interface_name];
      if (!dep_service_name) continue;

      const to = buildNodeRef(dependency, 'services', dep_service_name);

      if (!graph.nodes_map.has(to)) continue;

      if (interface_type === 'interfaces') {
        if (from === to) continue;
        const edge = new ServiceEdge(from, to, interface_name);
        graph.addEdge(edge);
      } else if (interface_type === 'ingresses') {
        const gateway_node = this.manager.getGatewayNode();
        graph.addNode(gateway_node);

        const ingress_edge = new IngressEdge(gateway_node.ref, to, interface_name);
        graph.addEdge(ingress_edge);

        if (from !== to) {
          const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
          graph.addEdge(ingress_consumer_edge);
        }
      }
    }
  }
}
