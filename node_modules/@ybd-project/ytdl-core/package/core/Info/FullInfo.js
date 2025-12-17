"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFullInfo = getFullInfo;
const Signature_1 = require("../../core/Signature");
const Platform_1 = require("../../platforms/Platform");
const General_1 = __importDefault(require("../../utils/General"));
const Url_1 = require("../../utils/Url");
const Format_1 = require("../../utils/Format");
const Formats_1 = require("./parser/Formats");
const BasicInfo_1 = require("./BasicInfo");
const Html5Player_1 = require("./parser/Html5Player");
/* Private Constants */
const CACHE = Platform_1.Platform.getShim().cache, SIGNATURE = new Signature_1.Signature();
async function _getFullInfo(id, options) {
    const BASIC_INFO = await (0, BasicInfo_1._getBasicInfo)(id, options, true), HTML5_PLAYER_PROMISE = (0, Html5Player_1.getPlayerFunctions)(options, options.html5Player), INFO = Object.assign({}, BASIC_INFO), FUNCTIONS = [], HTML5_PLAYER = await HTML5_PLAYER_PROMISE;
    await SIGNATURE.getDecipherFunctions(HTML5_PLAYER);
    await SIGNATURE.getNTransform(HTML5_PLAYER);
    try {
        const FORMATS = BASIC_INFO.formats;
        FUNCTIONS.push(SIGNATURE.decipherFormats(FORMATS));
        if (options.parsesHLSFormat && INFO._playerApiResponses?.ios) {
            FUNCTIONS.push(...Formats_1.FormatParser.parseAdditionalManifests(INFO._playerApiResponses.ios, options));
        }
    }
    catch { }
    const RESULTS = Object.values(Object.assign({}, ...(await Promise.all(FUNCTIONS))));
    INFO.formats = RESULTS.map((format) => Format_1.FormatUtils.addFormatMeta(format, options.includesOriginalFormatData ?? false));
    INFO.formats.sort(Format_1.FormatUtils.sortFormats);
    INFO.full = true;
    if (!options.includesPlayerAPIResponse) {
        delete INFO._playerApiResponses;
    }
    if (!options.includesNextAPIResponse) {
        delete INFO._nextApiResponses;
    }
    return INFO;
}
async function getFullInfo(link, options) {
    General_1.default.checkForUpdates();
    const ID = Url_1.Url.getVideoID(link) || (Url_1.Url.validateID(link) ? link : null);
    if (!ID) {
        throw new Error('The URL specified is not a valid URL.');
    }
    const CACHE_KEY = ['getFullInfo', ID, options.hl, options.gl].join('-');
    if (await CACHE.has(CACHE_KEY)) {
        return CACHE.get(CACHE_KEY);
    }
    const RESULTS = await _getFullInfo(ID, options);
    CACHE.set(CACHE_KEY, RESULTS, {
        ttl: 60 * 30, //30Min
    });
    return RESULTS;
}
//# sourceMappingURL=FullInfo.js.map