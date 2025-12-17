"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ReturnStatement extends BaseJSNode_js_1.default {
    run() {
        if (this.node.argument) {
            return this.visitor.visitNode(this.node.argument);
        }
    }
}
exports.default = ReturnStatement;
//# sourceMappingURL=ReturnStatement.js.map