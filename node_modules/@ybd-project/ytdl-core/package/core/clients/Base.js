"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Platform_1 = require("../../platforms/Platform");
const errors_1 = require("../../core/errors");
const Fetcher_1 = require("../../core/Fetcher");
const Log_1 = require("../../utils/Log");
const SHIM = Platform_1.Platform.getShim();
class Base {
    static playError(playerResponse) {
        const PLAYABILITY = playerResponse && playerResponse.playabilityStatus;
        if (!PLAYABILITY) {
            return null;
        }
        const STATUS = playerResponse.playabilityStatus.reason || null;
        if (PLAYABILITY.status === 'ERROR' || PLAYABILITY.status === 'LOGIN_REQUIRED') {
            return new errors_1.UnrecoverableError(PLAYABILITY.reason || (PLAYABILITY.messages && PLAYABILITY.messages[0]) || 'Unknown error.', STATUS);
        }
        else if (PLAYABILITY.status === 'LIVE_STREAM_OFFLINE') {
            return new errors_1.UnrecoverableError(PLAYABILITY.reason || 'The live stream is offline.', STATUS);
        }
        else if (PLAYABILITY.status === 'UNPLAYABLE') {
            return new errors_1.UnrecoverableError(PLAYABILITY.reason || 'This video is unavailable.', STATUS);
        }
        return null;
    }
    static request(url, requestOptions, params, clientName) {
        return new Promise(async (resolve, reject) => {
            const HEADERS = {
                'Content-Type': 'application/json',
                'X-Origin': 'https://www.youtube.com',
                ...requestOptions.headers,
            }, OPTS = {
                requestOptions: {
                    method: 'POST',
                    headers: HEADERS,
                    body: typeof requestOptions.payload === 'string' ? requestOptions.payload : JSON.stringify(requestOptions.payload),
                },
                rewriteRequest: params.options.rewriteRequest,
                originalProxy: params.options.originalProxy,
            }, IS_NEXT_API = url.includes('/next'), ALLOW_RETRY_REQUEST = !params.options.disableRetryRequest && (((OPTS.originalProxy || OPTS.rewriteRequest) && SHIM.runtime !== 'browser') || HEADERS['Authorization']), responseHandler = (response, isRetried = false) => {
                const PLAY_ERROR = this.playError(response);
                if (PLAY_ERROR) {
                    if (!isRetried && ALLOW_RETRY_REQUEST) {
                        return retryRequest(PLAY_ERROR);
                    }
                    return reject({
                        isError: true,
                        error: PLAY_ERROR,
                        contents: response,
                    });
                }
                if (!IS_NEXT_API && (!response.videoDetails || params.videoId !== response.videoDetails.videoId)) {
                    const ERROR = new errors_1.PlayerRequestError('Malformed response from YouTube', response, null);
                    ERROR.response = response;
                    if (!isRetried && ALLOW_RETRY_REQUEST) {
                        return retryRequest(ERROR);
                    }
                    return reject({
                        isError: true,
                        error: ERROR,
                        contents: response,
                    });
                }
                resolve({
                    isError: false,
                    error: null,
                    contents: response,
                });
            }, retryRequest = (error) => {
                OPTS.originalProxy = undefined;
                OPTS.rewriteRequest = undefined;
                const HEADERS = new SHIM.polyfills.Headers(OPTS.requestOptions?.headers);
                HEADERS.delete('Authorization');
                if (!OPTS.requestOptions) {
                    OPTS.requestOptions = {};
                }
                OPTS.requestOptions.headers = HEADERS;
                Log_1.Logger.debug(`[ ${clientName} ]: <info>Wait 2 seconds</info> and <warning>retry request...</warning> (Reason: <error>${error?.message}</error>)`);
                setTimeout(() => {
                    Fetcher_1.Fetcher.request(url, OPTS)
                        .then((res) => responseHandler(res, true))
                        .catch((err) => {
                        reject({
                            isError: true,
                            error: err,
                            contents: null,
                        });
                    });
                }, 2000);
                return;
            };
            try {
                Fetcher_1.Fetcher.request(url, OPTS)
                    .then((res) => responseHandler(res, false))
                    .catch((err) => {
                    if (ALLOW_RETRY_REQUEST) {
                        return retryRequest(err);
                    }
                    reject({
                        isError: true,
                        error: err,
                        contents: null,
                    });
                });
            }
            catch (err) {
                reject({
                    isError: true,
                    error: err,
                    contents: null,
                });
            }
        });
    }
}
exports.default = Base;
//# sourceMappingURL=Base.js.map