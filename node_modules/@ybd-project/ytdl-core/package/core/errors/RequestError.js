"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RequestError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode || 0;
    }
}
exports.default = RequestError;
//# sourceMappingURL=RequestError.js.map