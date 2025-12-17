"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ForStatement extends BaseJSNode_js_1.default {
    run() {
        if (this.node.init) {
            this.visitor.visitNode(this.node.init);
        }
        const test = () => {
            return this.node.test
                ? this.visitor.visitNode(this.node.test)
                : true;
        };
        for (;;) {
            const _test = test();
            if (!_test) {
                break;
            }
            const body = this.visitor.visitNode(this.node.body);
            if (body === 'continue') {
                continue;
            }
            if (body === 'break') {
                break;
            }
            if (this.node.update) {
                this.visitor.visitNode(this.node.update);
            }
            if (body && this.node.body.type !== 'ExpressionStatement') {
                return body;
            }
        }
    }
}
exports.default = ForStatement;
//# sourceMappingURL=ForStatement.js.map