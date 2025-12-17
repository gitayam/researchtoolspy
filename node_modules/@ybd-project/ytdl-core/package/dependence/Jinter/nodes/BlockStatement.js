"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class BlockStatement extends BaseJSNode_js_1.default {
    run() {
        for (const stmt of this.node.body) {
            const result = this.visitor.visitNode(stmt);
            if (stmt.type === 'ReturnStatement')
                return result;
            if (result === 'break' || result === 'continue')
                return result;
            if ((stmt.type === 'WhileStatement' ||
                stmt.type === 'IfStatement' ||
                stmt.type === 'ForStatement' ||
                stmt.type === 'TryStatement') &&
                !!result) {
                return result;
            }
        }
    }
}
exports.default = BlockStatement;
//# sourceMappingURL=BlockStatement.js.map