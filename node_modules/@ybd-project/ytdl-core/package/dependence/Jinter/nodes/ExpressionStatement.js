"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ExpressionStatement extends BaseJSNode_js_1.default {
    run() {
        return this.visitor.visitNode(this.node.expression);
    }
}
exports.default = ExpressionStatement;
//# sourceMappingURL=ExpressionStatement.js.map