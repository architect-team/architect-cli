"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class DependencyEdge {
    constructor(from, to, type = 'dependency') {
        this.from = from;
        this.to = to;
        this.type = type;
    }
}
exports.default = DependencyEdge;
//# sourceMappingURL=edge.js.map