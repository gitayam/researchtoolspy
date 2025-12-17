"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class LogicalExpression extends BaseJSNode_js_1.default {
    run() {
        const operator = this.node.operator;
        switch (operator) {
            case '&&': {
                const left_side = this.visitor.visitNode(this.node.left);
                if (left_side === true)
                    return this.visitor.visitNode(this.node.right);
                return left_side;
            }
            case '||': {
                const left_side = this.visitor.visitNode(this.node.left);
                return left_side || this.visitor.visitNode(this.node.right);
            }
            case '??': {
                const left_side = this.visitor.visitNode(this.node.left);
                return left_side ?? this.visitor.visitNode(this.node.right);
            }
        }
    }
}
exports.default = LogicalExpression;
//# sourceMappingURL=LogicalExpression.js.map