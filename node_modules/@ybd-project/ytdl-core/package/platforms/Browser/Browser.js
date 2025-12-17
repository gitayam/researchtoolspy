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
Object.defineProperty(exports, "__esModule", { value: true });
exports.YtdlCore = void 0;
const Platform_1 = require("../../platforms/Platform");
const Constants_1 = require("../../utils/Constants");
class CacheWithCacheStorage {
    constructor(ttl = 60) {
        this.ttl = ttl;
        this.isDisabled = false;
    }
    async getCache() {
        return await caches.open('ytdlCoreCache');
    }
    async get(key) {
        if (this.isDisabled) {
            return null;
        }
        const CACHE = await this.getCache(), RESPONSE = await CACHE.match(key);
        if (RESPONSE) {
            try {
                const DATA = await RESPONSE.json();
                if (Date.now() > DATA.expiration) {
                    return null;
                }
                return DATA.contents;
            }
            catch { }
        }
        return null;
    }
    async set(key, value, { ttl } = { ttl: this.ttl }) {
        if (this.isDisabled) {
            return true;
        }
        const CACHE = await this.getCache(), DATA = JSON.stringify({
            contents: value,
            expiration: Date.now() + ttl * 1000,
        }), RESPONSE = new Response(DATA, {
            headers: { 'Content-Type': 'application/json' },
        });
        try {
            await CACHE.put(key, RESPONSE);
            return true;
        }
        catch {
            return false;
        }
    }
    async has(key) {
        if (this.isDisabled) {
            return false;
        }
        const CACHE = await this.getCache(), RESPONSE = await CACHE.match(key);
        return RESPONSE !== undefined;
    }
    async delete(key) {
        if (this.isDisabled) {
            return true;
        }
        const CACHE = await this.getCache();
        try {
            return await CACHE.delete(key);
        }
        catch {
            return false;
        }
    }
    disable() {
        this.isDisabled = true;
    }
    initialization() { }
}
Platform_1.Platform.load({
    runtime: 'browser',
    server: false,
    cache: new CacheWithCacheStorage(),
    fileCache: new CacheWithCacheStorage(),
    fetcher: (url, options) => fetch(url, options),
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
        Headers,
        ReadableStream,
        eval,
    },
});
const YtdlCore_1 = require("../../YtdlCore");
Object.defineProperty(exports, "YtdlCore", { enumerable: true, get: function () { return YtdlCore_1.YtdlCore; } });
__exportStar(require("../../types/index"), exports);
exports.default = YtdlCore_1.YtdlCore;
//# sourceMappingURL=Browser.js.map