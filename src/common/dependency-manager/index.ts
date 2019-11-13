import DependencyEdge from './edge';
import { LocalDependencyNode } from './node/local';
import { RemoteDependencyNode } from './node/remote';
import DependencyNode from './node';
import SubscriptionEdge from './edge/subscription';

export default class DependencyManager {
  nodes: Map<string, LocalDependencyNode | RemoteDependencyNode> = new Map();
  edges: DependencyEdge[] = [];

  addNode(service: LocalDependencyNode | RemoteDependencyNode): LocalDependencyNode | RemoteDependencyNode {
    if (this.nodes.has(service.ref)) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      return this.nodes.get(service.ref)!;
    }

    this.nodes.set(service.ref, service);
    return service;
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

  addDependency(
    from: LocalDependencyNode | RemoteDependencyNode,
    to: LocalDependencyNode | RemoteDependencyNode,
  ) {
    from = this.addNode(from);
    to = this.addNode(to);

    const edgeIndex = this.edges.findIndex(edge => edge.from.equals(from) && edge.to.equals(to));
    if (edgeIndex < 0) {
      const edge = new DependencyEdge(from, to);
      this.edges.push(edge);
    }

    return this;
  }

  addSubscription(
    publisher: LocalDependencyNode | RemoteDependencyNode,
    subscriber: LocalDependencyNode | RemoteDependencyNode,
  ) {
    publisher = this.addNode(publisher);
    subscriber = this.addNode(subscriber);

    const edgeIndex = this.edges.findIndex(edge => edge.from.equals(publisher) && edge.to.equals(subscriber));
    if (edgeIndex < 0) {
      const edge = new SubscriptionEdge(publisher, subscriber);
      this.edges.push(edge);
    }

    return this;
  }
}
