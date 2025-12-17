"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const clients_1 = require("../../../core/clients");
const Base_1 = __importDefault(require("./Base"));
class NextApi {
    static async getApiResponses(nextApiParams) {
        const NEXT_API_PROMISE = {
            web: clients_1.Web.getNextResponse(nextApiParams),
        }, NEXT_API_PROMISES = await Promise.allSettled(Object.values(NEXT_API_PROMISE)), NEXT_API_RESPONSES = {
            web: Base_1.default.checkResponse(NEXT_API_PROMISES[0], 'Next')?.contents || null,
        };
        return NEXT_API_RESPONSES;
    }
}
exports.default = NextApi;
//# sourceMappingURL=Next.js.map