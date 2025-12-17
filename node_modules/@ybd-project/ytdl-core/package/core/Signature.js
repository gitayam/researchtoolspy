"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Signature = void 0;
const Platform_1 = require("../platforms/Platform");
const Log_1 = require("../utils/Log");
const Html5Player_1 = require("../utils/Html5Player");
const SIGNATURE_TIMESTAMP_REGEX = /signatureTimestamp:(\d+)/g, SHIM = Platform_1.Platform.getShim(), FILE_CACHE = SHIM.fileCache;
/* Decipher */
function getDecipheredFormat(format, decipherFunction, nTransformFunction) {
    const DECIPHERED = format;
    DECIPHERED._deciphered = true;
    if (!decipherFunction) {
        return DECIPHERED;
    }
    const decipher = (url) => {
        const SEARCH_PARAMS = new URLSearchParams('?' + url), PARAMS_URL = SEARCH_PARAMS.get('url')?.toString() || '', PARAMS_S = SEARCH_PARAMS.get('s');
        if (!PARAMS_S) {
            return PARAMS_URL;
        }
        try {
            const COMPONENTS = new URL(decodeURIComponent(PARAMS_URL)), RESULTS = SHIM.polyfills.eval(`var ${decipherFunction.argumentName}='${decodeURIComponent(PARAMS_S)}';${decipherFunction.code}`);
            COMPONENTS.searchParams.set(SEARCH_PARAMS.get('sp')?.toString() || 'sig', RESULTS);
            return COMPONENTS.toString();
        }
        catch (err) {
            Log_1.Logger.debug(`[ Decipher ]: <error>Failed</error> to decipher URL: <error>${err}</error>`);
            return PARAMS_URL;
        }
    }, nTransform = (url) => {
        const COMPONENTS = new URL(decodeURIComponent(url)), N = COMPONENTS.searchParams.get('n');
        if (!N || !nTransformFunction) {
            return url;
        }
        try {
            const RESULTS = SHIM.polyfills.eval(`var ${nTransformFunction.argumentName}='${decodeURIComponent(N)}';${nTransformFunction.code}`);
            COMPONENTS.searchParams.set('n', RESULTS);
            return COMPONENTS.toString();
        }
        catch (err) {
            Log_1.Logger.debug(`[ NTransform ]: <error>Failed</error> to transform N: <error>${err}</error>`);
            return url;
        }
    }, CIPHER = !format.url, VIDEO_URL = format.url || format.signatureCipher || format.cipher;
    if (!VIDEO_URL) {
        return DECIPHERED;
    }
    DECIPHERED.url = nTransform(CIPHER ? decipher(VIDEO_URL) : VIDEO_URL);
    delete DECIPHERED.signatureCipher;
    delete DECIPHERED.cipher;
    return DECIPHERED;
}
class Signature {
    constructor() {
        this.decipherFunction = null;
        this.nTransformFunction = null;
    }
    static getSignatureTimestamp(body) {
        if (!body) {
            return '0';
        }
        const MATCH = body.match(SIGNATURE_TIMESTAMP_REGEX);
        if (MATCH) {
            return MATCH[0].split(':')[1];
        }
        return '0';
    }
    decipherFormat(format) {
        return getDecipheredFormat(format, this.decipherFunction, this.nTransformFunction);
    }
    decipherFormats(formats) {
        const DECIPHERED_FORMATS = {};
        formats.forEach((format) => {
            if (!format) {
                return;
            }
            getDecipheredFormat(format, this.decipherFunction, this.nTransformFunction);
            DECIPHERED_FORMATS[format.url] = format;
        });
        return DECIPHERED_FORMATS;
    }
    async getDecipherFunctions({ id, body }) {
        if (this.decipherFunction) {
            return this.decipherFunction;
        }
        const HTML5_PLAYER_CACHE = await FILE_CACHE.get('html5Player');
        if (HTML5_PLAYER_CACHE) {
            if (!this.decipherFunction) {
                this.decipherFunction = HTML5_PLAYER_CACHE.functions.decipher;
            }
            return HTML5_PLAYER_CACHE;
        }
        const DECIPHER_FUNCTION = (0, Html5Player_1.getDecipherFunction)(id, body) || null;
        this.decipherFunction = DECIPHER_FUNCTION;
        return DECIPHER_FUNCTION;
    }
    async getNTransform({ id, body }) {
        if (this.nTransformFunction) {
            return this.nTransformFunction;
        }
        const HTML5_PLAYER_CACHE = await FILE_CACHE.get('html5Player');
        if (HTML5_PLAYER_CACHE) {
            if (!this.nTransformFunction) {
                this.nTransformFunction = HTML5_PLAYER_CACHE.functions.nTransform;
            }
            return HTML5_PLAYER_CACHE;
        }
        const N_TRANSFORM_FUNCTION = (0, Html5Player_1.getNTransformFunction)(id, body) || null;
        this.nTransformFunction = N_TRANSFORM_FUNCTION;
        return N_TRANSFORM_FUNCTION;
    }
}
exports.Signature = Signature;
//# sourceMappingURL=Signature.js.map