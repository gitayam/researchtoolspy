"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class NewExpression extends BaseJSNode_js_1.default {
    run() {
        const callee = this.visitor.visitNode(this.node.callee);
        const args = this.node.arguments.map((arg) => this.visitor.visitNode(arg));
        return args.length ? new callee(args) : new callee();
    }
}
exports.default = NewExpression;
//# sourceMappingURL=NewExpression.js.map