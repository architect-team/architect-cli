"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const edge_1 = tslib_1.__importDefault(require("./edge"));
class DependencyGraph {
    constructor() {
        this.nodes = new Map();
        this.edges = [];
    }
    addNode(service) {
        if (this.nodes.has(service.ref)) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-ignore
            // @ts-ignore
            return this.nodes.get(service.ref);
        }
        this.nodes.set(service.ref, service);
        return service;
    }
    addEdge(from, to) {
        // Ensure the nodes exist in the pool
        from = this.addNode(from);
        to = this.addNode(to);
        const edgeIndex = this.edges.findIndex(edge => edge.from.equals(from) && edge.to.equals(to));
        if (edgeIndex < 0) {
            const edge = new edge_1.default(from, to);
            this.edges.push(edge);
        }
        return this;
    }
    getNodeDependencies(node) {
        const nodes = new Map();
        for (const edge of this.edges) {
            if (edge.from.equals(node)) {
                nodes.set(edge.to.ref, edge.to);
            }
        }
        return Array.from(nodes.values());
    }
}
exports.default = DependencyGraph;
//# sourceMappingURL=graph.js.map