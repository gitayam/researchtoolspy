"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ConditionalExpression extends BaseJSNode_js_1.default {
    run() {
        const { test, consequent, alternate } = this.node;
        const check = this.visitor.visitNode(test);
        if (check) {
            return this.visitor.visitNode(consequent);
        }
        return this.visitor.visitNode(alternate);
    }
}
exports.default = ConditionalExpression;
//# sourceMappingURL=ConditionalExpression.js.map