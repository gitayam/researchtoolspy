"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class IfStatement extends BaseJSNode_js_1.default {
    run() {
        const test = this.visitor.visitNode(this.node.test);
        if (test) {
            return this.visitor.visitNode(this.node.consequent);
        }
        else if (this.node.alternate) {
            return this.visitor.visitNode(this.node.alternate);
        }
    }
}
exports.default = IfStatement;
//# sourceMappingURL=IfStatement.js.map