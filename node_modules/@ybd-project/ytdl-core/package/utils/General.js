"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lastUpdateCheck = void 0;
exports.between = between;
exports.tryParseBetween = tryParseBetween;
exports.parseAbbreviatedNumber = parseAbbreviatedNumber;
exports.cutAfterJS = cutAfterJS;
exports.checkForUpdates = checkForUpdates;
exports.getPropInsensitive = getPropInsensitive;
exports.setPropInsensitive = setPropInsensitive;
exports.generateClientPlaybackNonce = generateClientPlaybackNonce;
const Platform_1 = require("../platforms/Platform");
const Fetcher_1 = require("../core/Fetcher");
const Constants_1 = require("../utils/Constants");
const Log_1 = require("../utils/Log");
const ESCAPING_SEQUENCE = [
    { start: '"', end: '"' },
    { start: "'", end: "'" },
    { start: '`', end: '`' },
    { start: '/', end: '/', startPrefix: /(^|[[{:;,/])\s?$/ },
];
/** Check for updates. */
const UPDATE_INTERVAL = 1000 * 60 * 60 * 12;
/* ----------- */
/* Private Functions */
function findPropKeyInsensitive(obj, prop) {
    return Object.keys(obj).find((p) => p.toLowerCase() === prop.toLowerCase()) || null;
}
/* ----------- */
/* Public Functions */
/** Extract string inbetween another */
function between(haystack, left, right) {
    let pos = null;
    if (left instanceof RegExp) {
        const MATCH = haystack.match(left);
        if (!MATCH) {
            return '';
        }
        pos = (MATCH.index || 0) + MATCH[0].length;
    }
    else {
        pos = haystack.indexOf(left);
        if (pos === -1) {
            return '';
        }
        pos += left.length;
    }
    haystack = haystack.slice(pos);
    pos = haystack.indexOf(right);
    if (pos === -1) {
        return '';
    }
    haystack = haystack.slice(0, pos);
    return haystack;
}
function tryParseBetween(body, left, right, prepend = '', append = '') {
    try {
        const BETWEEN_STRING = between(body, left, right);
        if (!BETWEEN_STRING) {
            return null;
        }
        return JSON.parse(`${prepend}${BETWEEN_STRING}${append}`);
    }
    catch (err) {
        return null;
    }
}
/** Get a number from an abbreviated number string. */
function parseAbbreviatedNumber(string) {
    const MATCH = string
        .replace(',', '.')
        .replace(' ', '')
        .match(/([\d,.]+)([MK]?)/);
    if (MATCH) {
        const UNIT = MATCH[2];
        let number = MATCH[1];
        number = parseFloat(number);
        return Math.round(UNIT === 'M' ? number * 1000000 : UNIT === 'K' ? number * 1000 : number);
    }
    return null;
}
/** Match begin and end braces of input JS, return only JS */
function cutAfterJS(mixedJson) {
    let open = null, close = null;
    if (mixedJson[0] === '[') {
        open = '[';
        close = ']';
    }
    else if (mixedJson[0] === '{') {
        open = '{';
        close = '}';
    }
    if (!open) {
        throw new Error(`Can't cut unsupported JSON (need to begin with [ or { ) but got: ${mixedJson[0]}`);
    }
    // States if the loop is currently inside an escaped js object
    let isEscapedObject = null;
    // States if the current character is treated as escaped or not
    let isEscaped = false;
    // Current open brackets to be closed
    let counter = 0;
    for (let i = 0; i < mixedJson.length; i++) {
        if (isEscapedObject !== null && !isEscaped && mixedJson[i] === isEscapedObject.end) {
            isEscapedObject = null;
            continue;
        }
        else if (!isEscaped && isEscapedObject === null) {
            for (const ESCAPED of ESCAPING_SEQUENCE) {
                if (mixedJson[i] !== ESCAPED.start) {
                    continue;
                }
                if (!ESCAPED.startPrefix || mixedJson.substring(i - 10, i).match(ESCAPED.startPrefix)) {
                    isEscapedObject = ESCAPED;
                    break;
                }
            }
            if (isEscapedObject !== null) {
                continue;
            }
        }
        isEscaped = mixedJson[i] === '\\' && !isEscaped;
        if (isEscapedObject !== null) {
            continue;
        }
        if (mixedJson[i] === open) {
            counter++;
        }
        else if (mixedJson[i] === close) {
            counter--;
        }
        if (counter === 0) {
            return mixedJson.slice(0, i + 1);
        }
    }
    throw new Error(`Can't cut unsupported JSON (no matching closing bracket found)`);
}
function getPropInsensitive(obj, prop) {
    const KEY = findPropKeyInsensitive(obj, prop);
    return KEY && obj[KEY];
}
function setPropInsensitive(obj, prop, value) {
    const KEY = findPropKeyInsensitive(obj, prop);
    obj[KEY || prop] = value;
    return KEY;
}
function generateClientPlaybackNonce(length) {
    const CPN_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    return Array.from({ length }, () => CPN_CHARS[Math.floor(Math.random() * CPN_CHARS.length)]).join('');
}
/** Check for updates. */
let updateWarnTimes = 0;
let lastUpdateCheck = 0;
exports.lastUpdateCheck = lastUpdateCheck;
function checkForUpdates() {
    const SHIM = Platform_1.Platform.getShim(), YTDL_NO_UPDATE = SHIM.options.other.noUpdate;
    if (!YTDL_NO_UPDATE && Date.now() - lastUpdateCheck >= UPDATE_INTERVAL) {
        exports.lastUpdateCheck = lastUpdateCheck = Date.now();
        const PKG_GITHUB_API_URL = `https://raw.githubusercontent.com/${SHIM.info.repo.user}/${SHIM.info.repo.name}/dev/package.json`;
        Fetcher_1.Fetcher.request(PKG_GITHUB_API_URL, {
            requestOptions: { headers: { 'User-Agent': 'Chromium";v="112", "Microsoft Edge";v="112", "Not:A-Brand";v="99' } },
        }).then((response) => {
            const PKG_FILE = JSON.parse(response);
            if (PKG_FILE.version !== Constants_1.VERSION && updateWarnTimes++ < 5) {
                Log_1.Logger.warning('@ybd-project/ytdl-core is out of date! Update with "npm install @ybd-project/ytdl-core@latest".');
            }
        }, (err) => {
            Log_1.Logger.warning('Error checking for updates:', err.message);
            Log_1.Logger.warning('It can be disabled by setting `noUpdate` to `true` in the YtdlCore options.');
        });
    }
}
exports.default = { between, tryParseBetween, parseAbbreviatedNumber, cutAfterJS, lastUpdateCheck, checkForUpdates, getPropInsensitive, setPropInsensitive, generateClientPlaybackNonce };
//# sourceMappingURL=General.js.map