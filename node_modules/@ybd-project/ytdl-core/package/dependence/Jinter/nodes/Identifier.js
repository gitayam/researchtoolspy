"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class Identifier extends BaseJSNode_js_1.default {
    run() {
        if (this.visitor.listeners[this.node.name]) {
            const cb = this.visitor.listeners[this.node.name](this.node, this.visitor);
            if (cb !== '__continue_exec') {
                return cb;
            }
        }
        if (this.visitor.scope.has(this.node.name))
            return this.visitor.scope.get(this.node.name);
        return this.node.name;
    }
}
exports.default = Identifier;
//# sourceMappingURL=Identifier.js.map