"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class TryStatement extends BaseJSNode_js_1.default {
    run() {
        try {
            return this.visitor.visitNode(this.node.block);
        }
        catch (e) {
            if (this.node.handler) {
                if (this.node.handler.param && this.node.handler.param.type === 'Identifier') {
                    this.visitor.scope.set(this.node.handler.param.name, e);
                }
                return this.visitor.visitNode(this.node.handler.body);
            }
        }
        finally {
            this.visitor.visitNode(this.node.finalizer);
        }
    }
}
exports.default = TryStatement;
//# sourceMappingURL=TryStatement.js.map