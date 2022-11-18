import { Exclude, Type } from 'class-transformer';
import { DependencyEdge } from './edge';
import { IngressEdge } from './edge/ingress';
import { IngressConsumerEdge } from './edge/ingress-consumer';
import { ServiceEdge } from './edge/service';
import { DependencyNode } from './node';
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
        { value: IngressEdge, name: 'ingress' },
        { value: IngressConsumerEdge, name: 'ingress-consumer' },
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
    if (edge.from === edge.to) {
      throw new Error(`Edge cannot be self referential: ${edge.toString()}`);
    }

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
    const nodes = [];
    for (const edge of this.edges) {
      if (edge.from === node.ref) {
        nodes.push(this.getNodeByRef(edge.to));
      }
    }
    return nodes;
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

  getDependsOn(current_node: (ServiceNode | TaskNode)): (ServiceNode | TaskNode)[] {
    const simplified_edge_refs = new Set(this.edges.map(edge => `${edge.from}.${edge.to}`));

    const downstream_nodes = this.getDownstreamNodes(current_node);
    const depends_on_nodes = this.nodes
      .filter(node =>
        node.instance_id === current_node.instance_id &&
        node instanceof ServiceNode &&
        current_node.config.depends_on.includes(node.service_name),
      );

    const dependent_node_refs = new Set([
      ...downstream_nodes.map(node => node.ref),
      ...depends_on_nodes.map(node => node.ref),
    ]);

    const dependent_nodes: (ServiceNode | TaskNode)[] = [];
    for (const dependent_node_ref of dependent_node_refs) {
      const dependent_node = this.getNodeByRef(dependent_node_ref);
      if (dependent_node.is_external) continue;
      if (!(dependent_node instanceof ServiceNode || dependent_node instanceof TaskNode)) continue;
      // Check for circular dependency
      if (simplified_edge_refs.has(`${dependent_node.ref}.${current_node.ref}`)) continue;

      dependent_nodes.push(dependent_node);
    }

    return dependent_nodes;
  }
}

export type DependencyGraph = Readonly<DependencyGraphMutable>;
