import DependencyEdge from './edge';
import { DependencyNode } from './node';

export default class DependencyGraph {
  nodes: Map<string, DependencyNode> = new Map();
  edges: DependencyEdge[] = [];

  addNode(service: DependencyNode): DependencyNode {
    if (this.nodes.has(service.ref)) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
      // @ts-ignore
      return this.nodes.get(service.ref);
    }

    this.nodes.set(service.ref, service);
    return service;
  }

  addEdge(from: DependencyNode, to: DependencyNode) {
    // Ensure the nodes exist in the pool
    from = this.addNode(from);
    to = this.addNode(to);

    const edgeIndex = this.edges.findIndex(edge => edge.from.equals(from) && edge.to.equals(to));
    if (edgeIndex < 0) {
      const edge = new DependencyEdge(from, to);
      this.edges.push(edge);
    }

    return this;
  }

  getNodeDependencies(node: DependencyNode): DependencyNode[] {
    const nodes: Map<string, DependencyNode> = new Map();

    for (const edge of this.edges) {
      if (edge.from.equals(node)) {
        nodes.set(edge.to.ref, edge.to);
      }
    }

    return Array.from(nodes.values());
  }
}
