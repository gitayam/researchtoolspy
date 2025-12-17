"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class VariableDeclaration extends BaseJSNode_js_1.default {
    run() {
        // TODO: Parse kind
        this.node.declarations.forEach((declar) => {
            const { id, init } = declar;
            const key = this.visitor.getName(id);
            const value = init
                ? this.visitor.visitNode(init)
                : undefined;
            if (key)
                this.visitor.scope.set(key, value);
            if (typeof value === 'object' && value !== null)
                this.visitor.scope.set('_this', value);
        });
    }
}
exports.default = VariableDeclaration;
//# sourceMappingURL=VariableDeclaration.js.map