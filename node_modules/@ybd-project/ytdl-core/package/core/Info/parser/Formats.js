"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormatParser = void 0;
const Fetcher_1 = require("../../../core/Fetcher");
const Url_1 = require("../../../utils/Url");
class FormatParser {
    static parseFormats(playerResponse) {
        let formats = [];
        if (playerResponse && playerResponse.streamingData) {
            formats = formats.concat(playerResponse.streamingData.formats).concat(playerResponse.streamingData.adaptiveFormats);
        }
        return formats;
    }
    static async getM3U8(url, options) {
        const _URL = new URL(url, Url_1.Url.getBaseUrl()), BODY = await Fetcher_1.Fetcher.request(_URL.toString(), options), FORMATS = {};
        BODY.split('\n')
            .filter((line) => /^https?:\/\//.test(line))
            .forEach((line) => {
            const MATCH = line.match(/\/itag\/(\d+)\//) || [], ITAG = parseInt(MATCH[1]);
            FORMATS[line] = { itag: ITAG, url: line };
        });
        return FORMATS;
    }
    static parseAdditionalManifests(playerResponse, options) {
        const STREAMING_DATA = playerResponse && playerResponse.streamingData, MANIFESTS = [];
        if (STREAMING_DATA) {
            if (STREAMING_DATA.hlsManifestUrl) {
                MANIFESTS.push(this.getM3U8(STREAMING_DATA.hlsManifestUrl, options));
            }
        }
        return MANIFESTS;
    }
}
exports.FormatParser = FormatParser;
//# sourceMappingURL=Formats.js.map