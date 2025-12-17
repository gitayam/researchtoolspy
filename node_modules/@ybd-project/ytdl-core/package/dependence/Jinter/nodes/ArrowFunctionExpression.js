"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../utils/index.js");
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ArrowFunctionExpression extends BaseJSNode_js_1.default {
    run() {
        const { params, body } = this.node;
        // @TODO: Handle other types of params and pass them directly to next node instead of saving them in the global scope
        const fn = (0, index_js_1.namedFunction)('anonymous function', (args) => {
            let index = 0;
            for (const param of params) {
                this.visitor.visitNode(param);
                if (param.type === 'Identifier') {
                    this.visitor.scope.set(param.name, args[index]);
                }
                else {
                    console.warn('Unhandled param type', param.type);
                }
                index++;
            }
            return this.visitor.visitNode(body);
        });
        return fn;
    }
}
exports.default = ArrowFunctionExpression;
//# sourceMappingURL=ArrowFunctionExpression.js.map