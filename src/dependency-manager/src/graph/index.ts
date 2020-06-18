import { Exclude, Type } from 'class-transformer';
import DependencyEdge from './edge';
import IngressEdge from './edge/ingress';
import ServiceEdge from './edge/service';
import { DependencyNode } from './node';
import GatewayNode from './node/gateway';
import InterfacesNode from './node/interfaces';
import { ServiceNode } from './node/service';

export default class DependencyGraph {
  @Type(() => DependencyNode, {
    discriminator: {
      property: '__type',
      subTypes: [
        { value: ServiceNode, name: 'service' },
        { value: InterfacesNode, name: 'interfaces' },
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
      ],
    },
    keepDiscriminatorProperty: true,
  })
  edges: DependencyEdge[] = [];

  @Exclude()
  protected __nodes_map?: Map<string, DependencyNode>;
  @Exclude()
  protected __edges_map?: Map<string, DependencyEdge>;

  addNode(node: DependencyNode): DependencyNode {
    if (!this.nodes_map.has(node.ref)) {
      this.nodes.push(node);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.__nodes_map!.set(node.ref, node);
    }
    return node;
  }

  removeNodeByRef(ref: string) {
    this.nodes = this.nodes.filter(node => node.ref !== ref);
    this.__nodes_map = undefined;
    this.edges = this.edges.filter(edge => edge.from !== ref && edge.to !== ref);
    this.__edges_map = undefined;
  }

  removeEdgeByRef(edge_ref: string) {
    this.edges = this.edges.filter(edge => edge.ref !== edge_ref);
    this.__edges_map = undefined;
  }

  addEdge(edge: DependencyEdge): DependencyEdge {
    if (!this.edges_map.has(edge.ref)) {
      // Ensure the nodes exist in the pool
      this.getNodeByRef(edge.from);
      this.getNodeByRef(edge.to);

      this.edges.push(edge);
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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

  getNodeDependencies(node: DependencyNode): DependencyNode[] {
    const nodes: Map<string, DependencyNode> = new Map();

    for (const edge of this.edges) {
      if (edge.from === node.ref) {
        nodes.set(edge.to, this.getNodeByRef(edge.to));
      }
    }

    return Array.from(nodes.values());
  }

  removeNode(node_ref: string, cleanup_dangling: boolean) {
    const queue = [node_ref];
    while (queue.length > 0) {
      const ref = queue.shift();
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const node = this.getNodeByRef(ref!);
      const dependents = this.getDependentNodes(node).filter(n => !queue.includes(n.ref));
      const dependencies = this.getNodeDependencies(node);

      if (dependents.length === 0 || node_ref === ref) {
        this.removeNodeByRef(node.ref);

        if (cleanup_dangling) {
          dependencies.forEach((dep) => {
            if (!queue.includes(dep.ref)) {
              queue.push(dep.ref);
            }
          });
        }
      }
    }
  }

  getDependentNodes(node: DependencyNode) {
    const nodes = new Map();

    for (const edge of this.edges) {
      if (edge.to === node.ref) {
        nodes.set(edge.from, this.getNodeByRef(edge.from));
      }
    }

    return Array.from(nodes.values());
  }
}
