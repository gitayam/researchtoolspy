"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluate = evaluate;
const Jinter_1 = require("../../dependence/Jinter");
function evaluate(code) {
    const JINTER = new Jinter_1.Jinter();
    return JINTER.evaluate(code);
}
//# sourceMappingURL=Eval.js.map