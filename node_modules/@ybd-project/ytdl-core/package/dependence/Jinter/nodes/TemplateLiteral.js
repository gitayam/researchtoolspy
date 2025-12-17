"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class TemplateLiteral extends BaseJSNode_js_1.default {
    run() {
        let result = '';
        for (let i = 0; i < this.node.quasis.length; ++i) {
            const quasi = this.node.quasis[i];
            if (quasi.type === 'TemplateElement') {
                if (quasi.value.cooked === null) {
                    throw new Error(`Invalid template literal: ${quasi.value.raw}`);
                }
                if (quasi.value.cooked !== undefined) {
                    result += quasi.value.cooked;
                }
                if (!quasi.tail) {
                    const expr = this.node.expressions[i];
                    if (expr !== undefined) {
                        // This will automatically stringify the node's return value, since result is a string.
                        result += this.visitor.visitNode(expr);
                    }
                    else {
                        throw new Error(`Expected expression after: ${quasi.value}`);
                    }
                }
            }
            else {
                throw new Error(`Unhandled quasi type: ${quasi.type}`);
            }
        }
        return result;
    }
}
exports.default = TemplateLiteral;
//# sourceMappingURL=TemplateLiteral.js.map