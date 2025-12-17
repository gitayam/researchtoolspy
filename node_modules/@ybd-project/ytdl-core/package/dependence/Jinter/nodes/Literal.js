"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const BaseJSNode_js_1 = __importDefault(require("./BaseJSNode.js"));
class Literal extends BaseJSNode_js_1.default {
    run() {
        return this.node.value;
    }
}
exports.default = Literal;
//# sourceMappingURL=Literal.js.map