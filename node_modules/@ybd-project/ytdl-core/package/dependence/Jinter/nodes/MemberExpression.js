"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class MemberExpression extends BaseJSNode_js_1.default {
    run() {
        const { object, property, computed } = this.node;
        const obj = this.visitor.visitNode(object);
        const prop = computed ? this.visitor.visitNode(property) : this.visitor.getName(property);
        if (prop !== undefined || prop !== null) {
            if (this.visitor.listeners[prop]) {
                const cb = this.visitor.listeners[prop](this.node, this.visitor);
                if (cb !== '__continue_exec') {
                    return cb;
                }
            }
            return obj?.[prop];
        }
    }
}
exports.default = MemberExpression;
//# sourceMappingURL=MemberExpression.js.map