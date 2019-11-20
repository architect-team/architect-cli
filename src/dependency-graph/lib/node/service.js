"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require(".");
class ServiceNode extends _1.DependencyNode {
    constructor(options) {
        super(options);
        this.subscriptions = options.subscriptions || {};
        this.api = options.api;
    }
}
exports.ServiceNode = ServiceNode;
//# sourceMappingURL=service.js.map