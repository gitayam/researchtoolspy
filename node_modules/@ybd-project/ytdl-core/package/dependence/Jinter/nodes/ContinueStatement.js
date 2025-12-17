"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class ContinueStatement extends BaseJSNode_js_1.default {
    run() {
        return 'continue';
    }
}
exports.default = ContinueStatement;
//# sourceMappingURL=ContinueStatement.js.map