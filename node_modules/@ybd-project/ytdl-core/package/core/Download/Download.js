"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.download = download;
exports.downloadFromInfo = downloadFromInfo;
const Info_1 = require("../../core/Info");
const Format_1 = require("../../utils/Format");
const Log_1 = require("../../utils/Log");
const Platform_1 = require("../../platforms/Platform");
const UserAgents_1 = require("../../utils/UserAgents");
const DOWNLOAD_REQUEST_OPTIONS = {
    method: 'GET',
    headers: {
        accept: '*/*',
        origin: 'https://www.youtube.com',
        referer: 'https://www.youtube.com',
        DNT: '?1',
    },
    redirect: 'follow',
}, ReadableStream = Platform_1.Platform.getShim().polyfills.ReadableStream;
function requestSetup(url, requestOptions, options) {
    if (typeof options.rewriteRequest === 'function') {
        const { url: newUrl } = options.rewriteRequest(url, requestOptions, {
            isDownloadUrl: true,
        });
        url = newUrl;
    }
    if (options.originalProxy) {
        try {
            const PARSED = new URL(options.originalProxy.download);
            if (!url.includes(PARSED.host)) {
                url = `${PARSED.protocol}//${PARSED.host}${PARSED.pathname}?${options.originalProxy.urlQueryName || 'url'}=${encodeURIComponent(url)}`;
            }
        }
        catch (err) {
            Log_1.Logger.debug('[ OriginalProxy ]: The original proxy could not be adapted due to the following error: ' + err);
        }
    }
    return url;
}
async function isDownloadUrlValid(format, options) {
    return new Promise((resolve) => {
        const successResponseHandler = (res) => {
            if (res.status === 200) {
                Log_1.Logger.debug(`[ ${format.sourceClientName} ]: <success>Video URL is normal.</success> The response was received with status code <success>"${res.status}"</success>.`);
                resolve({ valid: true });
            }
            else {
                errorResponseHandler(new Error(`Status code: ${res.status}`));
            }
        }, errorResponseHandler = (reason) => {
            Log_1.Logger.debug(`[ ${format.sourceClientName} ]: The URL for the video <error>did not return a successful response</error>. Got another format.\nReason: <error>${reason.message}</error>`);
            resolve({ valid: false, reason: reason.message });
        };
        try {
            const TEST_URL = requestSetup(format.url, {}, options);
            Platform_1.Platform.getShim()
                .fetcher(TEST_URL, {
                method: 'HEAD',
            })
                .then((res) => successResponseHandler(res), (reason) => errorResponseHandler(reason));
        }
        catch (err) {
            errorResponseHandler(err);
        }
    });
}
function getValidDownloadUrl(formats, options) {
    return new Promise(async (resolve) => {
        let excludingClients = ['web'], format, isOk = false;
        try {
            format = Format_1.FormatUtils.chooseFormat(formats, options);
        }
        catch (e) {
            throw e;
        }
        if (!format) {
            throw new Error('Failed to retrieve format data.');
        }
        while (isOk === false) {
            if (!format) {
                throw new Error('Failed to retrieve format data.');
            }
            const { valid, reason } = await isDownloadUrlValid(format, options);
            if (valid) {
                isOk = true;
            }
            else {
                if (format.sourceClientName !== 'unknown') {
                    excludingClients.push(format.sourceClientName);
                }
                try {
                    format = Format_1.FormatUtils.chooseFormat(formats, {
                        excludingClients,
                        includingClients: reason?.includes('403') ? ['ios', 'android'] : 'all',
                        quality: options.quality,
                        filter: options.filter,
                    });
                }
                catch (e) {
                    throw e;
                }
            }
        }
        resolve(format);
    });
}
/** Reference: LuanRT/YouTube.js - Utils.ts */
async function* streamToIterable(stream) {
    if (stream instanceof ReadableStream) {
        const READER = stream.getReader();
        try {
            while (true) {
                const { done, value } = await READER.read();
                if (done) {
                    return;
                }
                yield value;
            }
        }
        finally {
            READER.releaseLock();
        }
    }
    else {
        try {
            for await (const CHUNK of stream) {
                yield CHUNK;
            }
        }
        finally {
            stream.destroy();
        }
    }
}
function downloadVideo(videoUrl, requestOptions, options, cancel) {
    videoUrl = requestSetup(videoUrl, requestOptions, options);
    Log_1.Logger.debug('[ Download ]: Requesting URL: <magenta>' + videoUrl + '</magenta>');
    const OPTIONS = cancel ? { ...requestOptions, signal: cancel.signal } : requestOptions;
    return Platform_1.Platform.getShim().fetcher(videoUrl, OPTIONS);
}
async function downloadFromInfoCallback(info, options) {
    if (!info.formats.length) {
        throw new Error('This video is not available due to lack of video format.');
    }
    const DL_CHUNK_SIZE = typeof options.dlChunkSize === 'number' ? options.dlChunkSize : 1024 * 1024 * 10, NO_NEED_SPECIFY_RANGE = (options.filter === 'audioandvideo' || options.filter === 'videoandaudio') && !options.range, FORMAT = await getValidDownloadUrl(info.formats, options);
    let requestOptions = { ...DOWNLOAD_REQUEST_OPTIONS }, chunkStart = options.range ? options.range.start : 0, chunkEnd = options.range ? options.range.end || DL_CHUNK_SIZE : DL_CHUNK_SIZE, shouldEnd = false, cancel;
    const AGENT_TYPE = FORMAT.sourceClientName === 'ios' || FORMAT.sourceClientName === 'android' ? FORMAT.sourceClientName : FORMAT.sourceClientName.includes('tv') ? 'tv' : 'desktop';
    requestOptions.headers = {
        ...requestOptions.headers,
        'User-Agent': UserAgents_1.UserAgent.getRandomUserAgent(AGENT_TYPE),
    };
    /* Reference: LuanRT/YouTube.js */
    if (NO_NEED_SPECIFY_RANGE) {
        const RESPONSE = await downloadVideo(FORMAT.url, requestOptions, options);
        if (!RESPONSE.ok) {
            throw new Error(`Download failed with status code <warning>"${RESPONSE.status}"</warning>.`);
        }
        const BODY = RESPONSE.body;
        if (!BODY) {
            throw new Error('Failed to retrieve response body.');
        }
        return BODY;
    }
    const READABLE_STREAM = new ReadableStream({
        start() { },
        pull: async (controller) => {
            if (shouldEnd) {
                controller.close();
                return;
            }
            const CONTENT_LENGTH = FORMAT.contentLength ? parseInt(FORMAT.contentLength) : 0;
            if (chunkEnd >= CONTENT_LENGTH || options.range) {
                shouldEnd = true;
            }
            return new Promise(async (resolve, reject) => {
                try {
                    cancel = new AbortController();
                    const RESPONSE = await downloadVideo(FORMAT.url + '&range=' + chunkStart + '-' + chunkEnd, requestOptions, options, cancel);
                    if (!RESPONSE.ok) {
                        throw new Error(`Download failed with status code <warning>"${RESPONSE.status}"</warning>.`);
                    }
                    const BODY = RESPONSE.body;
                    if (!BODY) {
                        throw new Error('Failed to retrieve response body.');
                    }
                    for await (const CHUNK of streamToIterable(BODY)) {
                        controller.enqueue(CHUNK);
                    }
                    chunkStart = chunkEnd + 1;
                    chunkEnd += DL_CHUNK_SIZE;
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        },
        async cancel(reason) {
            cancel.abort(reason);
        },
    }, {
        highWaterMark: options.highWaterMark || 1024 * 512,
        size(chunk) {
            return chunk?.byteLength || 0;
        },
    });
    return READABLE_STREAM;
}
async function downloadFromInfo(info, options) {
    if (!info.full) {
        throw new Error('Cannot use `ytdl.downloadFromInfo()` when called with info from `ytdl.getBasicInfo()`');
    }
    return new Promise((resolve) => {
        resolve(downloadFromInfoCallback(info, options));
    });
}
function download(link, options) {
    return new Promise((resolve) => {
        (0, Info_1.getFullInfo)(link, options)
            .then((info) => {
            resolve(downloadFromInfoCallback(info, options));
        })
            .catch((err) => {
            throw err;
        });
    });
}
//# sourceMappingURL=Download.js.map