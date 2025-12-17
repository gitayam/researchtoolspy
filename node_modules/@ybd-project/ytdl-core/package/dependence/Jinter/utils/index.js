"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JinterError = exports.namedFunction = void 0;
const namedFunction = (name, fn) => Object.defineProperty(fn, 'name', { value: name });
exports.namedFunction = namedFunction;
class JinterError extends Error {
    constructor(message, info) {
        super(message);
        if (info) {
            this.info = info;
        }
    }
}
exports.JinterError = JinterError;
//# sourceMappingURL=index.js.map