"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class BreakStatement extends BaseJSNode_js_1.default {
    run() {
        // @TODO: Parse label
        return 'break';
    }
}
exports.default = BreakStatement;
//# sourceMappingURL=BreakStatement.js.map