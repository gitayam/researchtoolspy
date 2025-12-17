"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Clients_1 = require("./meta/Clients");
const Base_1 = __importDefault(require("./Base"));
class TvEmbedded {
    static async getPlayerResponse(params) {
        const { url, payload, headers } = Clients_1.Clients.tvEmbedded(params);
        return await Base_1.default.request(url, { payload, headers }, params, 'TvEmbedded');
    }
}
exports.default = TvEmbedded;
//# sourceMappingURL=TvEmbedded.js.map