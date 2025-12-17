"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const RequestError_1 = __importDefault(require("./RequestError"));
class PlayerRequestError extends RequestError_1.default {
    constructor(message, response, statusCode) {
        super(message);
        this.response = response;
        this.statusCode = statusCode || 0;
    }
}
exports.default = PlayerRequestError;
//# sourceMappingURL=PlayerRequestError.js.map