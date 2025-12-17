"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class WhileStatement extends BaseJSNode_js_1.default {
    run() {
        while (this.visitor.visitNode(this.node.test)) {
            const body = this.visitor.visitNode(this.node.body);
            if (body === 'break')
                break;
            if (body === 'continue')
                continue;
            if (body)
                return body;
        }
    }
}
exports.default = WhileStatement;
//# sourceMappingURL=WhileStatement.js.map