"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class BinaryExpression extends BaseJSNode_js_1.default {
    run() {
        const operator = this.node.operator;
        const left_node = this.visitor.visitNode(this.node.left);
        const right_node = this.visitor.visitNode(this.node.right);
        switch (operator) {
            case '!=':
                return left_node != right_node;
            case '!==':
                return left_node !== right_node;
            case '%':
                return left_node % right_node;
            case '&':
                return left_node & right_node;
            case '*':
                return left_node * right_node;
            case '**':
                return left_node ** right_node;
            case '+':
                return left_node + right_node;
            case '-':
                return left_node - right_node;
            case '/':
                return left_node / right_node;
            case '<':
                return left_node < right_node;
            case '<<':
                return left_node << right_node;
            case '<=':
                return left_node <= right_node;
            case '==':
                return left_node == right_node;
            case '===':
                return left_node === right_node;
            case '>':
                return left_node > right_node;
            case '>=':
                return left_node >= right_node;
            case '>>':
                return left_node >> right_node;
            case '>>>':
                return left_node >>> right_node;
            case '^':
                return left_node ^ right_node;
            case '|':
                return left_node | right_node;
            case 'in':
                return left_node in right_node;
            case 'instanceof':
                return left_node instanceof right_node;
        }
    }
}
exports.default = BinaryExpression;
//# sourceMappingURL=BinaryExpression.js.map