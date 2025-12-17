"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ObjectExpression extends BaseJSNode_js_1.default {
    run() {
        let result = {};
        for (const prop of this.node.properties) {
            if (prop.type === 'Property') {
                result = { ...result, ...this.visitor.visitNode(prop) };
            }
            else {
                throw new Error(`Unhandled property type: ${prop.type}`);
            }
        }
        return result;
    }
}
exports.default = ObjectExpression;
//# sourceMappingURL=ObjectExpression.js.map