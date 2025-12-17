"use strict";
var __classPrivateFieldSet = (this && this.__classPrivateFieldSet) || function (receiver, state, value, kind, f) {
    if (kind === "m") throw new TypeError("Private method is not writable");
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
};
var __classPrivateFieldGet = (this && this.__classPrivateFieldGet) || function (receiver, state, kind, f) {
    if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
};
var _a, _Platform_shim;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Platform = void 0;
const errors_1 = require("../core/errors");
const Log_1 = require("../utils/Log");
class Platform {
    static load(shim) {
        shim.fileCache.initialization();
        __classPrivateFieldSet(this, _a, shim, "f", _Platform_shim);
        Log_1.Logger.initialization();
    }
    static getShim() {
        if (!__classPrivateFieldGet(this, _a, "f", _Platform_shim)) {
            throw new errors_1.PlatformError('Platform is not loaded');
        }
        return __classPrivateFieldGet(this, _a, "f", _Platform_shim);
    }
}
exports.Platform = Platform;
_a = Platform;
_Platform_shim = { value: void 0 };
//# sourceMappingURL=Platform.js.map