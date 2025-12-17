"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPipeableStream = exports.YtdlCore = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const web_1 = require("stream/web");
const undici_1 = require("undici");
const Platform_1 = require("../../platforms/Platform");
const Classes_1 = require("../../platforms/utils/Classes");
const Readable_1 = require("../../platforms/utils/Readable");
Object.defineProperty(exports, "toPipeableStream", { enumerable: true, get: function () { return Readable_1.toPipeableStream; } });
const Eval_1 = require("../../platforms/utils/Eval");
const Constants_1 = require("../../utils/Constants");
const Log_1 = require("../../utils/Log");
import('./PoToken.mjs')
    .then((m) => {
    const SHIM = Platform_1.Platform.getShim();
    SHIM.poToken = m.generatePoToken;
    Platform_1.Platform.load(SHIM);
})
    .catch(() => { });
class FileCache {
    constructor() {
        this.isDisabled = false;
        this.cacheDir = path_1.default.resolve(__dirname, './.CacheFiles/');
    }
    async get(cacheName) {
        if (this.isDisabled) {
            return null;
        }
        try {
            if (!this.has(cacheName)) {
                return null;
            }
            const FILE_PATH = path_1.default.resolve(this.cacheDir, cacheName + '.txt'), PARSED_DATA = JSON.parse(fs_1.default.readFileSync(FILE_PATH, 'utf8'));
            if (Date.now() > PARSED_DATA.expiration) {
                return null;
            }
            Log_1.Logger.debug(`[ FileCache ]: Cache key <blue>"${cacheName}"</blue> was available.`);
            try {
                return JSON.parse(PARSED_DATA.contents);
            }
            catch {
                return PARSED_DATA.contents;
            }
        }
        catch (err) {
            return null;
        }
    }
    async set(cacheName, data, options = { ttl: 60 * 60 * 24 }) {
        if (this.isDisabled) {
            Log_1.Logger.debug(`[ FileCache ]: <blue>"${cacheName}"</blue> is not cached.`);
            return false;
        }
        try {
            fs_1.default.writeFileSync(path_1.default.resolve(this.cacheDir, cacheName + '.txt'), JSON.stringify({
                expiration: Date.now() + options.ttl * 1000,
                contents: data,
            }));
            Log_1.Logger.debug(`[ FileCache ]: <success>"${cacheName}"</success> is cached.`);
            return true;
        }
        catch (err) {
            Log_1.Logger.error(`Failed to cache ${cacheName}.\nDetails: `, err);
            return false;
        }
    }
    async has(cacheName) {
        if (this.isDisabled) {
            return true;
        }
        try {
            return fs_1.default.existsSync(path_1.default.resolve(this.cacheDir, cacheName + '.txt'));
        }
        catch {
            return false;
        }
    }
    async delete(cacheName) {
        if (this.isDisabled) {
            return true;
        }
        try {
            if (!this.has(cacheName)) {
                return true;
            }
            const FILE_PATH = path_1.default.resolve(this.cacheDir, cacheName + '.txt');
            fs_1.default.unlinkSync(FILE_PATH);
            Log_1.Logger.debug(`[ FileCache ]: Cache key <blue>"${cacheName}"</blue> was deleted.`);
            return true;
        }
        catch (err) {
            return false;
        }
    }
    disable() {
        this.isDisabled = true;
    }
    initialization() {
        if (typeof process !== 'undefined') {
            this.isDisabled = !!(process.env._YTDL_DISABLE_FILE_CACHE !== 'false' && process.env._YTDL_DISABLE_FILE_CACHE);
            try {
                if (!fs_1.default.existsSync(this.cacheDir)) {
                    fs_1.default.mkdirSync(this.cacheDir);
                }
            }
            catch {
                try {
                    this.cacheDir = path_1.default.resolve(os_1.default.tmpdir(), './.YtdlCore-Cache/');
                    if (!fs_1.default.existsSync(this.cacheDir)) {
                        fs_1.default.mkdirSync(this.cacheDir);
                    }
                }
                catch {
                    process.env._YTDL_DISABLE_FILE_CACHE = 'true';
                    this.isDisabled = true;
                }
            }
        }
    }
}
Platform_1.Platform.load({
    runtime: 'default',
    server: true,
    cache: new Classes_1.CacheWithMap(),
    fileCache: new FileCache(),
    fetcher: undici_1.fetch,
    poToken: async () => ({
        poToken: '',
        visitorData: '',
    }),
    options: {
        download: {
            hl: 'en',
            gl: 'US',
            includesPlayerAPIResponse: false,
            includesNextAPIResponse: false,
            includesOriginalFormatData: false,
            includesRelatedVideo: true,
            clients: ['web', 'mweb', 'tv', 'ios'],
            disableDefaultClients: false,
            disableFileCache: false,
            parsesHLSFormat: true,
        },
        other: {
            logDisplay: ['info', 'success', 'warning', 'error'],
            noUpdate: false,
        },
    },
    requestRelated: {
        rewriteRequest: (url, options) => {
            return { url, options };
        },
        originalProxy: null,
    },
    info: {
        version: Constants_1.VERSION,
        repo: {
            user: Constants_1.USER_NAME,
            name: Constants_1.REPO_NAME,
        },
        issuesUrl: Constants_1.ISSUES_URL,
    },
    polyfills: {
        Headers: undici_1.Headers,
        ReadableStream: web_1.ReadableStream,
        eval: Eval_1.evaluate,
    },
});
const IS_NODE_VERSION_OK = parseInt(process.version.replace('v', '').split('.')[0]) >= 16;
if (!IS_NODE_VERSION_OK) {
    throw new errors_1.PlatformError(`You are using Node.js ${process.version} which is not supported. Minimum version required is v16.`);
}
const YtdlCore_1 = require("../../YtdlCore");
Object.defineProperty(exports, "YtdlCore", { enumerable: true, get: function () { return YtdlCore_1.YtdlCore; } });
const errors_1 = require("../../core/errors");
__exportStar(require("../../types/index"), exports);
exports.default = YtdlCore_1.YtdlCore;
//# sourceMappingURL=Default.js.map