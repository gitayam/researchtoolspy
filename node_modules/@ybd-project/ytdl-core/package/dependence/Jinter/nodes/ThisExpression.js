"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ThisExpression extends BaseJSNode_js_1.default {
    run() {
        return this.visitor.scope.get('_this');
    }
}
exports.default = ThisExpression;
//# sourceMappingURL=ThisExpression.js.map