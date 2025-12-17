"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class SequenceExpression extends BaseJSNode_js_1.default {
    run() {
        let result;
        for (const expression of this.node.expressions) {
            result = this.visitor.visitNode(expression);
        }
        return result;
    }
}
exports.default = SequenceExpression;
//# sourceMappingURL=SequenceExpression.js.map