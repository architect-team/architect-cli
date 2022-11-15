import { serialize } from 'class-transformer';
import { buildNodeRef, ComponentConfig, ComponentSlugUtils, IngressEdge, ResourceType, ServiceEdge, Slugs } from '../..';
import { DependencyGraph } from '../graph';
import { IngressConsumerEdge } from '../graph/edge/ingress-consumer';
import DependencyManager from '../manager';
import { replaceInterpolationBrackets } from '../utils/interpolation';

// TODO:TJ move to own file
abstract class DeprecatedSpec {
  protected manager: DependencyManager;
  constructor(manager: DependencyManager) {
    this.manager = manager;
  }

  public abstract shouldRun(component_configs: ComponentConfig[]): boolean;
  public abstract transformGraph(graph: DependencyGraph, component_configs: ComponentConfig[]): void;
}

export class DeprecatedInterfacesSpec extends DeprecatedSpec {
  public shouldRun(component_configs: ComponentConfig[]): boolean {
    return component_configs.some(component_config => Object.keys(component_config.metadata.deprecated_interfaces_map).length > 0);
  }

  public transformGraph(graph: DependencyGraph, component_configs: ComponentConfig[]): void {
    for (const component_config of component_configs) {
      const services = Object.entries(component_config.services).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'services' as ResourceType, resource_config }));
      const tasks = Object.entries(component_config.tasks).map(([resource_name, resource_config]) => ({ resource_name, resource_type: 'tasks' as ResourceType, resource_config }));
      for (const { resource_config, resource_name, resource_type } of [...services, ...tasks]) {
        const resource_string = replaceInterpolationBrackets(serialize(resource_config));
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

      const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
      graph.addEdge(ingress_consumer_edge);
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

      const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
      graph.addEdge(ingress_consumer_edge);
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
        const edge = new ServiceEdge(from, to, interface_name);
        graph.addEdge(edge);
      } else if (interface_type === 'ingresses') {
        const gateway_node = this.manager.getGatewayNode();
        graph.addNode(gateway_node);

        const ingress_edge = new IngressEdge(gateway_node.ref, to, interface_name);
        graph.addEdge(ingress_edge);

        const ingress_consumer_edge = new IngressConsumerEdge(from, to, interface_name);
        graph.addEdge(ingress_consumer_edge);
      }
    }
  }
}
