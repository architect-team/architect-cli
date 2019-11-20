import DependencyEdge from './edge';
import { DependencyNode } from './node';
export default class DependencyGraph {
    nodes: Map<string, DependencyNode>;
    edges: DependencyEdge[];
    addNode(service: DependencyNode): DependencyNode;
    addEdge(from: DependencyNode, to: DependencyNode): this;
    getNodeDependencies(node: DependencyNode): DependencyNode[];
}
