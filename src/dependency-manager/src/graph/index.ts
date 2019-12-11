import { Exclude, Type } from 'class-transformer';
import DependencyEdge from './edge';
import { DependencyNode } from './node';

export default abstract class DependencyGraph {
  version: string;
  @Type(() => DependencyNode)
  nodes: DependencyNode[] = [];
  @Type(() => DependencyEdge)
  edges: DependencyEdge[] = [];

  @Exclude()
  protected __nodes_map?: Map<string, DependencyNode>;

  constructor(version: string) {
    this.version = version;
  }

  addNode(node: DependencyNode): DependencyNode {
    if (!this.nodes_map.has(node.ref)) {
      this.nodes.push(node);
      this.__nodes_map = undefined;
    }
    return node;
  }

  addEdge(from: DependencyNode, to: DependencyNode, type: 'dependency' | 'notification' = 'dependency') {
    // Ensure the nodes exist in the pool
    from = this.addNode(from);
    to = this.addNode(to);

    const edgeIndex = this.edges.findIndex(edge => edge.from === from.ref && edge.to === to.ref);
    if (edgeIndex < 0) {
      const edge = new DependencyEdge(from.ref, to.ref, type);
      this.edges.push(edge);
    }

    return this;
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

  getEdgesWithNodes() {
    const edges = [];
    for (const edge of this.edges) {
      edges.push({
        ...edge,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        from: this.nodes_map.get(edge.from)!,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        to: this.nodes_map.get(edge.to)!,
      });
    }
    return edges;
  }

  getNodeDependencies(node: DependencyNode): DependencyNode[] {
    const nodes: Map<string, DependencyNode> = new Map();

    for (const edge of this.edges) {
      if (edge.from === node.ref) {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        nodes.set(edge.to, this.nodes_map.get(edge.to)!);
      }
    }

    return Array.from(nodes.values());
  }
}
