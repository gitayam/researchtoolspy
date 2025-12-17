"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class AssignmentExpression extends BaseJSNode_js_1.default {
    run() {
        const operator = this.node.operator;
        const right_node = this.visitor.visitNode(this.node.right);
        switch (operator) {
            case '=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] = right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    this.visitor.scope.set(this.node.left.name, right_node);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '+=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] += right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) + right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '-=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] -= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) - right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '*=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] *= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) * right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '/=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] /= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) / right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '%=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] %= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) % right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '**=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] **= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) ** right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '<<=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] <<= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) << right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '>>=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] >>= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) >> right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '>>>=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] >>>= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) >>> right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
            case '&=':
                if (this.node.left.type === 'MemberExpression') {
                    const obj = this.visitor.visitNode(this.node.left.object);
                    const prop = this.visitor.visitNode(this.node.left.property);
                    return (obj[prop] &= right_node);
                }
                else if (this.node.left.type === 'Identifier') {
                    const result = this.visitor.visitNode(this.node.left) & right_node;
                    this.visitor.scope.set(this.node.left.name, result);
                    return this.visitor.scope.get(this.node.left.name);
                }
                console.warn('Unhandled left node', this.node.left);
                break;
        }
    }
}
exports.default = AssignmentExpression;
//# sourceMappingURL=AssignmentExpression.js.map