"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DependencyNode {
    constructor(options) {
        this.name = options.name;
        this.ports = options.ports;
        this.image = options.image;
        this.host = options.host || '0.0.0.0';
        this.tag = options.tag || 'latest';
        this.parameters = options.parameters || {};
    }
    get normalized_ref() {
        return this.ref
            .replace(/:/g, '.')
            .replace(/\//g, '.');
    }
    get ref() {
        return `${this.name}:${this.tag}`;
    }
    equals(node) {
        return this.ref === node.ref;
    }
}
exports.DependencyNode = DependencyNode;
//# sourceMappingURL=index.js.map