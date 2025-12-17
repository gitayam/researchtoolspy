"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlayerFunctions = getPlayerFunctions;
const Platform_1 = require("../../../platforms/Platform");
const Signature_1 = require("../../../core/Signature");
const Fetcher_1 = require("../../../core/Fetcher");
const Url_1 = require("../../../utils/Url");
const Log_1 = require("../../../utils/Log");
const Html5Player_1 = require("../../../utils/Html5Player");
const SHIM = Platform_1.Platform.getShim(), GITHUB_API_BASE_URL = `https://raw.githubusercontent.com/${SHIM.info.repo.user}/${SHIM.info.repo.name}/refs/heads/dev/data/player`, FileCache = SHIM.fileCache;
function getPlayerId(body) {
    if (!body) {
        return null;
    }
    const MATCH = body.match(/player\\\/([a-zA-Z0-9]+)\\\//);
    if (MATCH) {
        return MATCH[1];
    }
    return null;
}
async function getPlayerFunctions(options, html5Player) {
    const CACHE = await FileCache.get('html5Player');
    if (CACHE && CACHE.signatureTimestamp) {
        return CACHE;
    }
    Log_1.Logger.debug('To speed up processing, html5Player and signatureTimestamp are pre-fetched and cached.');
    let playerId = undefined, playerBody = undefined;
    if (!html5Player?.useRetrievedFunctionsFromGithub) {
        try {
            const IFRAME_API_BODY = await Fetcher_1.Fetcher.request(Url_1.Url.getIframeApiUrl(), options);
            playerId = getPlayerId(IFRAME_API_BODY);
        }
        catch { }
    }
    if (html5Player?.useRetrievedFunctionsFromGithub || !playerId) {
        const GITHUB_PLAYER_DATA = await Fetcher_1.Fetcher.request(GITHUB_API_BASE_URL + '/data.json');
        FileCache.set('html5Player', GITHUB_PLAYER_DATA);
        return JSON.parse(GITHUB_PLAYER_DATA);
    }
    const PLAYER_URL = Url_1.Url.getPlayerJsUrl(playerId);
    if (PLAYER_URL) {
        try {
            playerBody = await Fetcher_1.Fetcher.request(PLAYER_URL, options);
        }
        catch { }
    }
    if (!playerBody) {
        try {
            playerBody = await Fetcher_1.Fetcher.request(GITHUB_API_BASE_URL + '/base.js');
        }
        catch { }
    }
    if (!playerBody) {
        throw new Error('Failed to retrieve player body.');
    }
    const DATA = {
        id: playerId,
        body: playerBody,
        signatureTimestamp: PLAYER_URL ? Signature_1.Signature.getSignatureTimestamp(playerBody) || '' : '',
        functions: {
            decipher: (0, Html5Player_1.getDecipherFunction)(playerId, playerBody),
            nTransform: (0, Html5Player_1.getNTransformFunction)(playerId, playerBody),
        },
    };
    FileCache.set('html5Player', JSON.stringify(DATA));
    return DATA;
}
//# sourceMappingURL=Html5Player.js.map