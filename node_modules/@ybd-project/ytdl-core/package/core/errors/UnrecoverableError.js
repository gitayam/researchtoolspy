"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class UnrecoverableError extends Error {
    constructor(message, playabilityStatus = null) {
        super(message);
        this.playabilityStatus = playabilityStatus;
    }
}
exports.default = UnrecoverableError;
//# sourceMappingURL=UnrecoverableError.js.map