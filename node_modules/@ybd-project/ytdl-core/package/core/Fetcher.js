"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Fetcher = void 0;
const Platform_1 = require("../platforms/Platform");
const Log_1 = require("../utils/Log");
const UserAgents_1 = require("../utils/UserAgents");
const errors_1 = require("./errors");
class Fetcher {
    static async fetch(url, options, noProxyAdaptation = false) {
        const SHIM = Platform_1.Platform.getShim(), { rewriteRequest, originalProxy } = SHIM.requestRelated;
        if (!noProxyAdaptation) {
            if (typeof rewriteRequest === 'function') {
                const WROTE_REQUEST = rewriteRequest(url, options || {}, { isDownloadUrl: false });
                options = WROTE_REQUEST.options;
                url = WROTE_REQUEST.url;
            }
            if (originalProxy) {
                try {
                    const PARSED = new URL(originalProxy.base);
                    if (!url.includes(PARSED.host)) {
                        url = `${PARSED.protocol}//${PARSED.host}/?${originalProxy.urlQueryName || 'url'}=${encodeURIComponent(url)}`;
                    }
                }
                catch { }
            }
        }
        Log_1.Logger.debug(`[ Request ]: <magenta>${options?.method || 'GET'}</magenta> -> ${url}`);
        const HEADERS = new SHIM.polyfills.Headers();
        if (options?.headers) {
            Object.entries(options.headers).forEach(([key, value]) => {
                if (value) {
                    HEADERS.append(key, value.toString());
                }
            });
        }
        if (!HEADERS.has('User-Agent')) {
            HEADERS.append('User-Agent', UserAgents_1.UserAgent.getRandomUserAgent('desktop'));
        }
        return await SHIM.fetcher(url, {
            method: options?.method || 'GET',
            headers: HEADERS,
            body: options?.body?.toString(),
        });
    }
    static async request(url, { requestOptions, rewriteRequest, originalProxy } = {}) {
        if (typeof rewriteRequest === 'function') {
            const WROTE_REQUEST = rewriteRequest(url, requestOptions || {}, { isDownloadUrl: false });
            requestOptions = WROTE_REQUEST.options;
            url = WROTE_REQUEST.url;
        }
        if (originalProxy) {
            try {
                const PARSED = new URL(originalProxy.base);
                if (!url.includes(PARSED.host)) {
                    url = `${PARSED.protocol}//${PARSED.host}${PARSED.pathname}?${originalProxy.urlQueryName || 'url'}=${encodeURIComponent(url)}`;
                }
            }
            catch { }
        }
        const REQUEST_RESULTS = await Fetcher.fetch(url, {
            method: requestOptions?.method || 'GET',
            headers: requestOptions?.headers,
            body: requestOptions?.body?.toString(),
        }, true), STATUS_CODE = REQUEST_RESULTS.status.toString(), LOCATION = REQUEST_RESULTS.headers.get('location') || null;
        if (STATUS_CODE.startsWith('2')) {
            const CONTENT_TYPE = REQUEST_RESULTS.headers.get('content-type') || '';
            if (CONTENT_TYPE.includes('application/json')) {
                return REQUEST_RESULTS.json();
            }
            return REQUEST_RESULTS.text();
        }
        else if (STATUS_CODE.startsWith('3') && LOCATION) {
            return Fetcher.request(LOCATION.toString(), { requestOptions, rewriteRequest, originalProxy });
        }
        const ERROR = new errors_1.RequestError(`Status Code: ${STATUS_CODE}`, REQUEST_RESULTS.status);
        throw ERROR;
    }
}
exports.Fetcher = Fetcher;
//# sourceMappingURL=Fetcher.js.map