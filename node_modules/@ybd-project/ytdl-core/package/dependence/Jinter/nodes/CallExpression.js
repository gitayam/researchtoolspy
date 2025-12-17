"use strict";
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _CallExpression_instances, _CallExpression_throwError, _CallExpression_getCalleeString;
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
const index_js_1 = require("../utils/index.js");
class CallExpression extends BaseJSNode_js_1.default {
    constructor() {
        super(...arguments);
        _CallExpression_instances.add(this);
    }
    run() {
        let exp_object;
        let exp_property;
        if (this.node.callee.type === 'MemberExpression') {
            exp_object = this.visitor.getName(this.node.callee.object);
            exp_property = this.visitor.getName(this.node.callee.property);
        }
        else if (this.node.callee.type === 'Identifier') {
            exp_property = this.node.callee.name;
        }
        // Obj.fn(...);
        if (exp_object && this.visitor.listeners[exp_object]) {
            const cb = this.visitor.listeners[exp_object](this.node, this.visitor);
            if (cb !== '__continue_exec') {
                return cb;
            }
        }
        // ?.fn(...);
        if (exp_property && exp_property !== 'toString' && this.visitor.listeners[exp_property]) {
            const cb = this.visitor.listeners[exp_property](this.node, this.visitor);
            if (cb !== '__continue_exec') {
                return cb;
            }
        }
        if (this.node.callee.type === 'MemberExpression') {
            if (Builtins.has(this.node, this.visitor)) {
                return Builtins.execute(this.node, this.visitor);
            }
            const obj = this.visitor.visitNode(this.node.callee.object);
            const prop = this.node.callee.computed ? this.visitor.visitNode(this.node.callee.property) : this.visitor.getName(this.node.callee.property);
            const args = this.node.arguments.map((arg) => this.visitor.visitNode(arg));
            if (!obj)
                __classPrivateFieldGet(this, _CallExpression_instances, "m", _CallExpression_throwError).call(this);
            if (typeof obj[prop] !== 'function')
                __classPrivateFieldGet(this, _CallExpression_instances, "m", _CallExpression_throwError).call(this);
            if (obj[prop].toString().includes('[native code]'))
                return obj[prop](...args);
            return obj[prop](args);
        }
        const fn = this.visitor.visitNode(this.node.callee);
        const args = this.node.arguments.map((arg) => this.visitor.visitNode(arg));
        if (typeof fn !== 'function')
            __classPrivateFieldGet(this, _CallExpression_instances, "m", _CallExpression_throwError).call(this);
        return fn(args);
    }
}
_CallExpression_instances = new WeakSet(), _CallExpression_throwError = function _CallExpression_throwError() {
    if (this.node.callee.type === 'MemberExpression' || this.node.callee.type === 'Identifier') {
        const callee_string = __classPrivateFieldGet(this, _CallExpression_instances, "m", _CallExpression_getCalleeString).call(this, this.node.callee);
        throw new index_js_1.JinterError(`${callee_string} is not a function`);
    }
    else if (this.node.callee.type === 'SequenceExpression') {
        const call = [];
        const items = [];
        call.push('(');
        this.node.callee.expressions.forEach((expr) => {
            if (expr.type === 'Literal') {
                items.push(expr.raw || '');
            }
            else if (expr.type === 'Identifier') {
                items.push(expr.name);
            }
            else if (expr.type === 'MemberExpression') {
                if (expr.computed) {
                    items.push(`${this.visitor.getName(expr.object)}[${this.visitor.getName(expr.property) || '...'}]`);
                }
                else {
                    items.push(`${this.visitor.getName(expr.object)}.${this.visitor.getName(expr.property)}`);
                }
            }
        });
        call.push(items.join(', '));
        call.push(')');
        throw new index_js_1.JinterError(`${call.join('')} is not a function`);
    }
}, _CallExpression_getCalleeString = function _CallExpression_getCalleeString(node) {
    if (node.type === 'Identifier') {
        return node.name;
    }
    else if (node.type === 'MemberExpression') {
        const object_string = __classPrivateFieldGet(this, _CallExpression_instances, "m", _CallExpression_getCalleeString).call(this, node.object);
        const property_string = node.computed ? `[${this.visitor.getName(node.property) || '...'}]` : `.${this.visitor.getName(node.property)}`;
        return `${object_string}${property_string}`;
    }
    return '<unknown>';
};
exports.default = CallExpression;
class Builtins {
    static has(node, visitor) {
        if (node.callee.type === 'MemberExpression') {
            return !!this.builtins?.[visitor.getName(node.callee.property) || ''];
        }
        return false;
    }
    static execute(node, visitor) {
        if (node.callee.type === 'MemberExpression') {
            return this.builtins[visitor.getName(node.callee.property) || ''](node, visitor);
        }
    }
}
Builtins.builtins = {
    // Override the forEach method so that the "this" arg is set correctly
    forEach: (node, visitor) => {
        const args = node.arguments.map((arg) => visitor.visitNode(arg));
        if (node.callee.type === 'MemberExpression') {
            const arr = visitor.visitNode(node.callee.object);
            // Set forEach's “this” arg
            if (args.length > 1) {
                visitor.scope.set('_this', args.slice(-1)[0]);
            }
            // Execute callback function
            let index = 0;
            for (const element of arr) {
                args[0]([element, index++, arr]);
            }
        }
        else {
            console.warn('Unhandled callee type:', node.callee.type);
        }
    },
    // Also override the toString method so that it stringifies the correct object
    toString: (node, visitor) => {
        if (node.callee.type === 'MemberExpression') {
            return visitor.visitNode(node.callee.object).toString();
        }
    }
};
//# sourceMappingURL=CallExpression.js.map