import { Exclude, Type } from 'class-transformer';
import { DependencyEdge } from './edge';
import { IngressEdge } from './edge/ingress';
import { OutputEdge } from './edge/output';
import { ServiceEdge } from './edge/service';
import { DependencyNode } from './node';
import { ComponentNode } from './node/component';
import { GatewayNode } from './node/gateway';
import { ServiceNode } from './node/service';
import { TaskNode } from './node/task';

export class DependencyGraphMutable {
  @Type(() => DependencyNode, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: ServiceNode, name: 'service' },
        { value: TaskNode, name: 'task' },
        { value: ComponentNode, name: 'interfaces' },
        { value: GatewayNode, name: 'gateway' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  nodes: DependencyNode[] = [];

  @Type(() => DependencyEdge, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: ServiceEdge, name: 'service' },
        { value: OutputEdge, name: 'output' },
        { value: IngressEdge, name: 'ingress' },
      ],
    },
    keepDiscriminatorProperty: true,
  })
  edges: DependencyEdge[] = [];

  validated = false;

  @Exclude()
  protected __nodes_map?: Map<string, DependencyNode>;
  @Exclude()
  protected __edges_map?: Map<string, DependencyEdge>;

  addNode(node: DependencyNode): DependencyNode {
    if (!this.nodes_map.has(node.ref)) {
      this.nodes.push(node);
      this.__nodes_map!.set(node.ref, node);
    }
    return node;
  }

  removeNodeByRef(ref: string): void {
    this.nodes = this.nodes.filter(node => node.ref !== ref);
    this.__nodes_map = undefined;
    this.edges = this.edges.filter(edge => edge.from !== ref && edge.to !== ref);
    this.__edges_map = undefined;
  }

  removeEdgeByRef(edge_ref: string): void {
    this.edges = this.edges.filter(edge => edge.ref !== edge_ref);
    this.__edges_map = undefined;
  }

  addEdge(edge: DependencyEdge): DependencyEdge {
    if (!this.edges_map.has(edge.ref)) {
      // Ensure the nodes exist in the pool
      this.getNodeByRef(edge.from);
      this.getNodeByRef(edge.to);

      this.edges.push(edge);
      this.__edges_map!.set(edge.ref, edge);
    }
    return edge;
  }

  get nodes_map(): Map<string, DependencyNode> {
    if (!this.__nodes_map) {
      this.__nodes_map = new Map();
      for (const node of this.nodes) {
        this.__nodes_map.set(node.ref, node);
      }
    }
    return this.__nodes_map;
  }

  get edges_map(): Map<string, DependencyEdge> {
    if (!this.__edges_map) {
      this.__edges_map = new Map();
      for (const edge of this.edges) {
        this.__edges_map.set(edge.ref, edge);
      }
    }
    return this.__edges_map;
  }

  getNodeByRef(ref: string): DependencyNode {
    const node = this.nodes_map.get(ref);
    if (!node)
      throw new Error(`Node not found for ref: ${ref}`);
    return node;
  }

  getDownstreamNodes(node: DependencyNode): DependencyNode[] {
    const nodes: Map<string, DependencyNode> = new Map();

    for (const edge of this.edges) {
      if (edge.from === node.ref) {
        nodes.set(edge.to, this.getNodeByRef(edge.to));
      }
    }

    return [...nodes.values()];
  }

  removeNode(node_ref: string, cleanup_dangling: boolean): void {
    const queue = [node_ref];
    while (queue.length > 0) {
      const ref = queue.shift();
      const node = this.getNodeByRef(ref!);
      const dependents = this.getUpstreamNodes(node).filter(n => !queue.includes(n.ref));
      const dependencies = this.getDownstreamNodes(node);

      if (dependents.length === 0 || node_ref === ref) {
        this.removeNodeByRef(node.ref);

        if (cleanup_dangling) {
          for (const dep of dependencies) {
            if (!queue.includes(dep.ref)) {
              queue.push(dep.ref);
            }
          }
        }
      }
    }
  }

  getUpstreamNodes(node: DependencyNode): DependencyNode[] {
    const nodes = new Map();

    for (const edge of this.edges) {
      if (edge.to === node.ref) {
        nodes.set(edge.from, this.getNodeByRef(edge.from));
      }
    }

    return [...nodes.values()];
  }

  followEdge(root_edge: DependencyEdge): { interface_from: string, interface_to: string, node_to: DependencyNode, node_to_interface_name: string }[] {
    const queue = [root_edge];
    const res = [];
    while (queue.length) {
      const edge = queue.shift()!;
      const node_to = this.getNodeByRef(edge.to);
      if (node_to instanceof ComponentNode) {
        const child_edges = this.edges.filter(e => e.from === edge.to);
        for (const child_edge of child_edges) {
          queue.push(child_edge);
        }
      } else if (root_edge === edge) { // Support following ServiceEdge to another service
        for (const { interface_from, interface_to } of edge.interface_mappings) {
          res.push({
            interface_from,
            interface_to,
            node_to,
            node_to_interface_name: interface_to,
          });
        }
      } else {
        for (const { interface_from, interface_to } of root_edge.interface_mappings) {
          const interface_mapping = edge.interface_mappings.find((i) => i.interface_from === interface_to);
          if (interface_mapping) {
            res.push({
              interface_from,
              interface_to,
              node_to,
              node_to_interface_name: interface_mapping?.interface_to,
            });
          }
        }
      }
    }
    return res;
  }

  getDependsOn(node: ServiceNode | TaskNode): ServiceNode[] {
    const explicit_depends_on = this.getExplicitDependsOn(node);
    const cross_component_depends_on = this.getInterComponentDependsOn(node);
    const all_depends_on = [...explicit_depends_on, ...cross_component_depends_on];
    return all_depends_on.filter(n => !n.is_external);
  }

  private getExplicitDependsOn(node: ServiceNode | TaskNode): ServiceNode[] {
    return this.nodes
      .filter(n => n.instance_id === node.instance_id && node.config.depends_on.includes((n as ServiceNode | TaskNode)?.config?.reserved_name || (n as ServiceNode | TaskNode)?.config?.name))
      .filter(n => n instanceof ServiceNode)
      .map(n => n as ServiceNode);
  }

  private getInterComponentDependsOn(node: ServiceNode | TaskNode): ServiceNode[] {
    const downstreams = this.getDownstreamServices(node);
    const inter_component_downstreams = downstreams.filter(n => n.instance_id !== node.instance_id); // filter out intra-component dependencies
    return inter_component_downstreams.filter(n => !this.isPartOfCircularDependency(n));
  }

  private getDownstreamServices(node: DependencyNode): ServiceNode[] {
    let downstreams = this.getDownstreamNodes(node);
    const interfaces = downstreams.filter(n => n instanceof ComponentNode);
    for (const i of interfaces) {
      const interface_downstreams = interfaces.map(i => this.getDownstreamNodes(i));
      for (const i_downstream of interface_downstreams) {
        downstreams = [...downstreams, ...i_downstream];
      }
    }
    downstreams = downstreams.filter((node, index, self) => self.findIndex(n => n.ref === node.ref) === index); // dedupe
    return downstreams.filter(n => n instanceof ServiceNode).map(n => n as ServiceNode);
  }

  private isPartOfCircularDependency(search_node: ServiceNode | TaskNode, current_node?: ServiceNode | TaskNode, seen_nodes: string[] = []) {
    const next_node = current_node || search_node;
    const dependencies = this.getDownstreamNodes(next_node)
      .filter(n => n instanceof ServiceNode)
      .map(n => n as ServiceNode);

    // we're in a circular ref but not one that the search_node is a part of
    if (seen_nodes.includes(next_node.ref)) {
      return false;
    }

    seen_nodes.push(next_node.ref);

    if (!dependencies?.length) {
      return false;
    }

    // search all dependencies and return true if one matches or one has a dependency that matches the original search_node
    for (const dependency of dependencies) {
      if (dependency.ref === search_node.ref) {
        return true;
      } else if (this.isPartOfCircularDependency(search_node, dependency, seen_nodes)) {
        return true;
      }
      // keep searching dependencies
    }

    // searched all dependencies and didn't find any circular dependencies
    return false;
  }
}

export type DependencyGraph = Readonly<DependencyGraphMutable>;
