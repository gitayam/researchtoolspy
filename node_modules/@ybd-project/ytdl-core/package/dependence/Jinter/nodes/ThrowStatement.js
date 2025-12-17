"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ThrowStatement extends BaseJSNode_js_1.default {
    run() {
        const arg = this.visitor.visitNode(this.node.argument);
        throw arg;
    }
}
exports.default = ThrowStatement;
//# sourceMappingURL=ThrowStatement.js.map