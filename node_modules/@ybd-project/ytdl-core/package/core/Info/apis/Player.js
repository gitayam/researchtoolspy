"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var CLIENTS_NUMBER;
(function (CLIENTS_NUMBER) {
    CLIENTS_NUMBER[CLIENTS_NUMBER["web"] = 0] = "web";
    CLIENTS_NUMBER[CLIENTS_NUMBER["webCreator"] = 1] = "webCreator";
    CLIENTS_NUMBER[CLIENTS_NUMBER["webEmbedded"] = 2] = "webEmbedded";
    CLIENTS_NUMBER[CLIENTS_NUMBER["tvEmbedded"] = 3] = "tvEmbedded";
    CLIENTS_NUMBER[CLIENTS_NUMBER["ios"] = 4] = "ios";
    CLIENTS_NUMBER[CLIENTS_NUMBER["android"] = 5] = "android";
    CLIENTS_NUMBER[CLIENTS_NUMBER["mweb"] = 6] = "mweb";
    CLIENTS_NUMBER[CLIENTS_NUMBER["tv"] = 7] = "tv";
})(CLIENTS_NUMBER || (CLIENTS_NUMBER = {}));
var UPPERCASE_CLIENTS;
(function (UPPERCASE_CLIENTS) {
    UPPERCASE_CLIENTS["web"] = "Web";
    UPPERCASE_CLIENTS["webCreator"] = "WebCreator";
    UPPERCASE_CLIENTS["webEmbedded"] = "WebEmbedded";
    UPPERCASE_CLIENTS["tvEmbedded"] = "TvEmbedded";
    UPPERCASE_CLIENTS["ios"] = "Ios";
    UPPERCASE_CLIENTS["android"] = "Android";
    UPPERCASE_CLIENTS["mweb"] = "MWeb";
    UPPERCASE_CLIENTS["tv"] = "Tv";
})(UPPERCASE_CLIENTS || (UPPERCASE_CLIENTS = {}));
const clients_1 = require("../../../core/clients");
const errors_1 = require("../../../core/errors");
const Log_1 = require("../../../utils/Log");
const Base_1 = __importDefault(require("./Base"));
class PlayerApi {
    static async getApiResponses(playerApiParams, clients) {
        const PLAYER_API_PROMISE = {
            web: clients.includes('web') ? clients_1.Web.getPlayerResponse(playerApiParams) : Promise.reject(null),
            webCreator: clients.includes('webCreator') ? clients_1.WebCreator.getPlayerResponse(playerApiParams) : Promise.reject(null),
            webEmbedded: clients.includes('webEmbedded') ? clients_1.WebEmbedded.getPlayerResponse(playerApiParams) : Promise.reject(null),
            tvEmbedded: clients.includes('tvEmbedded') ? clients_1.TvEmbedded.getPlayerResponse(playerApiParams) : Promise.reject(null),
            ios: clients.includes('ios') ? clients_1.Ios.getPlayerResponse(playerApiParams) : Promise.reject(null),
            android: clients.includes('android') ? clients_1.Android.getPlayerResponse(playerApiParams) : Promise.reject(null),
            mweb: clients.includes('mweb') ? clients_1.MWeb.getPlayerResponse(playerApiParams) : Promise.reject(null),
            tv: clients.includes('tv') ? clients_1.Tv.getPlayerResponse(playerApiParams) : Promise.reject(null),
        }, PLAYER_API_PROMISES = await Promise.allSettled(Object.values(PLAYER_API_PROMISE)), PLAYER_API_RESPONSES = {
            web: null,
            webCreator: null,
            webEmbedded: null,
            tvEmbedded: null,
            ios: null,
            android: null,
            mweb: null,
            tv: null,
        };
        clients.forEach((client) => {
            PLAYER_API_RESPONSES[client] = Base_1.default.checkResponse(PLAYER_API_PROMISES[CLIENTS_NUMBER[client]], UPPERCASE_CLIENTS[client])?.contents || null;
        });
        const IS_MINIMUM_MODE = PLAYER_API_PROMISES.every((r) => r.status === 'rejected');
        if (IS_MINIMUM_MODE) {
            const ERROR_TEXT = `All player APIs responded with an error. (Clients: ${clients.join(', ')})\nFor details, specify \`logDisplay: ["debug", "info", "success", "warning", "error"]\` in the constructor options of the YtdlCore class.`;
            if (PLAYER_API_RESPONSES.ios && !PLAYER_API_RESPONSES.ios.videoDetails) {
                throw new errors_1.UnrecoverableError(ERROR_TEXT + `\nNote: This error cannot continue processing. (Details: ${JSON.stringify(PLAYER_API_RESPONSES.ios.playabilityStatus.reason)})`, PLAYER_API_RESPONSES.ios.playabilityStatus.reason);
            }
            if (!PLAYER_API_RESPONSES.web) {
                Log_1.Logger.info('As a fallback to obtain the minimum information, the web client is forced to adapt.');
                const WEB_CLIENT_PROMISE = (await Promise.allSettled([clients_1.Web.getPlayerResponse(playerApiParams)]))[0];
                PLAYER_API_RESPONSES.web = Base_1.default.checkResponse(WEB_CLIENT_PROMISE, 'Web')?.contents || null;
            }
            Log_1.Logger.error(ERROR_TEXT);
            Log_1.Logger.info('Only minimal information is available, as information from the Player API is not available.');
        }
        return {
            isMinimalMode: IS_MINIMUM_MODE,
            responses: PLAYER_API_RESPONSES,
        };
    }
}
exports.default = PlayerApi;
//# sourceMappingURL=Player.js.map