"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class UnaryExpression extends BaseJSNode_js_1.default {
    run() {
        const operator = this.node.operator;
        switch (operator) {
            case '-': {
                const arg = this.visitor.visitNode(this.node.argument);
                return -arg;
            }
            case '+': {
                const arg = this.visitor.visitNode(this.node.argument);
                return +arg;
            }
            case '!': {
                const arg = this.visitor.visitNode(this.node.argument);
                return !arg;
            }
            case '~': {
                const arg = this.visitor.visitNode(this.node.argument);
                return ~arg;
            }
            case 'void': {
                this.visitor.visitNode(this.node.argument);
                return undefined;
            }
            case 'typeof': {
                const arg = this.visitor.visitNode(this.node.argument);
                return typeof arg;
            }
            case 'delete': {
                if (this.node.argument.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.argument.object);
                    const prop = this.node.argument.computed ? this.visitor.visitNode(this.node.argument.property) : this.visitor.getName(this.node.argument.property);
                    return delete obj[prop];
                }
                else if (this.node.argument.type === 'Identifier') {
                    return this.visitor.scope.delete(this.node.argument.name);
                }
                return true;
            }
            default:
                console.warn('Unhandled UnaryExpression operator', operator);
        }
    }
}
exports.default = UnaryExpression;
//# sourceMappingURL=UnaryExpression.js.map