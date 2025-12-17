"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CacheWithMap = exports.YtdlCore_Cache = void 0;
class YtdlCore_Cache {
}
exports.YtdlCore_Cache = YtdlCore_Cache;
class CacheWithMap {
    constructor(ttl = 60) {
        this.ttl = ttl;
        this.isDisabled = false;
        this.cache = new Map();
    }
    async get(key) {
        if (this.isDisabled) {
            return null;
        }
        const { contents, expiration } = this.cache.get(key) || { contents: null, expiration: 0 };
        if (Date.now() > expiration || !contents) {
            return null;
        }
        return contents;
    }
    async set(key, value, { ttl } = { ttl: this.ttl }) {
        if (this.isDisabled) {
            return true;
        }
        this.cache.set(key, {
            contents: value,
            expiration: Date.now() + ttl * 1000,
        });
        return true;
    }
    async has(key) {
        if (this.isDisabled) {
            return false;
        }
        return this.cache.has(key);
    }
    async delete(key) {
        if (this.isDisabled) {
            return true;
        }
        return this.cache.delete(key);
    }
    disable() {
        this.isDisabled = true;
    }
    initialization() { }
}
exports.CacheWithMap = CacheWithMap;
//# sourceMappingURL=Classes.js.map