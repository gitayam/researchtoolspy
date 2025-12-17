"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class SwitchCase extends BaseJSNode_js_1.default {
    run() {
        for (const stmt of this.node.consequent) {
            const result = this.visitor.visitNode(stmt);
            if (stmt.type === 'ContinueStatement' || stmt.type === 'BreakStatement') {
                return result;
            }
        }
    }
}
exports.default = SwitchCase;
//# sourceMappingURL=SwitchCase.js.map