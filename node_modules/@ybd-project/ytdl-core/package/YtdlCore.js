"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.YtdlCore = void 0;
const Platform_1 = require("./platforms/Platform");
const Download_1 = require("./core/Download");
const Info_1 = require("./core/Info");
const Html5Player_1 = require("./core/Info/parser/Html5Player");
const OAuth2_1 = require("./core/OAuth2");
const Url_1 = require("./utils/Url");
const Format_1 = require("./utils/Format");
const Constants_1 = require("./utils/Constants");
const Log_1 = require("./utils/Log");
const Signature_1 = require("./core/Signature");
const SHIM = Platform_1.Platform.getShim(), Cache = SHIM.cache, FileCache = SHIM.fileCache;
class YtdlCore {
    /* Constructor */
    constructor({ hl, gl, rewriteRequest, poToken, disablePoTokenAutoGeneration, visitorData, includesPlayerAPIResponse, includesNextAPIResponse, includesOriginalFormatData, includesRelatedVideo, clients, disableDefaultClients, disableRetryRequest, oauth2Credentials, parsesHLSFormat, originalProxy, quality, filter, excludingClients, includingClients, range, begin, liveBuffer, highWaterMark, IPv6Block, dlChunkSize, html5Player, disableBasicCache, disableFileCache, fetcher, logDisplay, noUpdate, disableInitialSetup } = {}) {
        /* Get Info Options */
        this.hl = 'en';
        this.gl = 'US';
        this.disablePoTokenAutoGeneration = false;
        this.includesPlayerAPIResponse = false;
        this.includesNextAPIResponse = false;
        this.includesOriginalFormatData = false;
        this.includesRelatedVideo = true;
        this.disableDefaultClients = false;
        this.disableRetryRequest = false;
        this.oauth2 = null;
        this.parsesHLSFormat = false;
        this.excludingClients = [];
        this.includingClients = 'all';
        /* Metadata */
        this.version = Constants_1.VERSION;
        const SHIM = Platform_1.Platform.getShim();
        /* Other Options */
        const LOG_DISPLAY = (logDisplay === 'none' ? [] : logDisplay) || ['info', 'success', 'warning', 'error'];
        SHIM.options.other.logDisplay = LOG_DISPLAY;
        Log_1.Logger.logDisplay = LOG_DISPLAY;
        SHIM.options.other.noUpdate = noUpdate ?? false;
        if (fetcher) {
            SHIM.fetcher = fetcher;
            SHIM.requestRelated.originalProxy = originalProxy;
            SHIM.requestRelated.rewriteRequest = rewriteRequest;
        }
        if (disableBasicCache) {
            Cache.disable();
        }
        if (disableFileCache) {
            FileCache.disable();
        }
        /* Get Info Options */
        this.hl = hl || 'en';
        this.gl = gl || 'US';
        this.rewriteRequest = rewriteRequest || undefined;
        this.disablePoTokenAutoGeneration = disablePoTokenAutoGeneration ?? false;
        this.includesPlayerAPIResponse = includesPlayerAPIResponse ?? false;
        this.includesNextAPIResponse = includesNextAPIResponse ?? false;
        this.includesOriginalFormatData = includesOriginalFormatData ?? false;
        this.includesRelatedVideo = includesRelatedVideo ?? true;
        this.clients = clients || undefined;
        this.disableDefaultClients = disableDefaultClients ?? false;
        this.parsesHLSFormat = parsesHLSFormat ?? false;
        this.disableRetryRequest = disableRetryRequest ?? false;
        this.originalProxy = originalProxy || undefined;
        if (this.originalProxy) {
            const QUERY_NAME = this.originalProxy.urlQueryName || 'url';
            Log_1.Logger.debug(`<debug>"${this.originalProxy.base}"</debug> is used for <blue>API requests</blue>.`);
            Log_1.Logger.debug(`<debug>"${this.originalProxy.download}"</debug> is used for <blue>video downloads</blue>.`);
            Log_1.Logger.debug(`The query name <debug>"${QUERY_NAME}"</debug> is used to specify the URL in the request. <blue>(?${QUERY_NAME}=...)</blue>`);
        }
        /* Format Selection Options */
        this.quality = quality || undefined;
        this.filter = filter || undefined;
        this.excludingClients = excludingClients || [];
        this.includingClients = includingClients || 'all';
        /* Download Options */
        this.range = range || undefined;
        this.begin = begin || undefined;
        this.liveBuffer = liveBuffer || undefined;
        this.highWaterMark = highWaterMark || undefined;
        this.IPv6Block = IPv6Block || undefined;
        this.dlChunkSize = dlChunkSize || undefined;
        this.html5Player = html5Player || undefined;
        /* Async Initial setup */
        this.init({ disableInitialSetup, poToken, visitorData, oauth2Credentials, html5Player }, {
            originalProxy,
            rewriteRequest,
        });
        /* Load */
        SHIM.options.download = {
            hl: this.hl,
            gl: this.gl,
            rewriteRequest: this.rewriteRequest,
            poToken: this.poToken,
            disablePoTokenAutoGeneration: this.disablePoTokenAutoGeneration,
            visitorData: this.visitorData,
            includesPlayerAPIResponse: this.includesPlayerAPIResponse,
            includesNextAPIResponse: this.includesNextAPIResponse,
            includesOriginalFormatData: this.includesOriginalFormatData,
            includesRelatedVideo: this.includesRelatedVideo,
            clients: this.clients,
            disableDefaultClients: this.disableDefaultClients,
            oauth2Credentials,
            parsesHLSFormat: this.parsesHLSFormat,
            originalProxy: this.originalProxy,
            quality: this.quality,
            filter: this.filter,
            excludingClients: this.excludingClients,
            includingClients: this.includingClients,
            range: this.range,
            begin: this.begin,
            liveBuffer: this.liveBuffer,
            highWaterMark: this.highWaterMark,
            IPv6Block: this.IPv6Block,
            dlChunkSize: this.dlChunkSize,
            html5Player: this.html5Player,
            disableRetryRequest: this.disableRetryRequest,
        };
        Platform_1.Platform.load(SHIM);
    }
    /* Setup */
    async init({ disableInitialSetup, poToken, visitorData, oauth2Credentials, html5Player }, requestInit = {}) {
        if (!disableInitialSetup) {
            const HTML5_PLAYER_PROMISE = (0, Html5Player_1.getPlayerFunctions)(requestInit, html5Player);
            await this.setPoToken(poToken);
            await this.setVisitorData(visitorData);
            await this.setOAuth2(oauth2Credentials || null);
            if (!this.disablePoTokenAutoGeneration) {
                this.automaticallyGeneratePoToken(requestInit);
            }
            await HTML5_PLAYER_PROMISE;
        }
    }
    async setPoToken(poToken) {
        const PO_TOKEN_CACHE = await FileCache.get('poToken');
        if (poToken) {
            this.poToken = poToken;
        }
        else if (PO_TOKEN_CACHE) {
            Log_1.Logger.debug('PoToken loaded from cache.');
            this.poToken = PO_TOKEN_CACHE || undefined;
        }
        FileCache.set('poToken', this.poToken || '', { ttl: 60 * 60 * 24 });
    }
    async setVisitorData(visitorData) {
        const VISITOR_DATA_CACHE = await FileCache.get('visitorData');
        if (visitorData) {
            this.visitorData = visitorData;
        }
        else if (VISITOR_DATA_CACHE) {
            Log_1.Logger.debug('VisitorData loaded from cache.');
            this.visitorData = VISITOR_DATA_CACHE || undefined;
        }
        FileCache.set('visitorData', this.visitorData || '', { ttl: 60 * 60 * 24 });
    }
    async setOAuth2(oauth2Credentials) {
        const OAUTH2_CACHE = (await FileCache.get('oauth2')) || undefined;
        try {
            if (oauth2Credentials) {
                this.oauth2 = new OAuth2_1.OAuth2(oauth2Credentials) || undefined;
            }
            else if (OAUTH2_CACHE) {
                this.oauth2 = new OAuth2_1.OAuth2(OAUTH2_CACHE);
            }
            else {
                this.oauth2 = null;
            }
        }
        catch {
            this.oauth2 = null;
        }
    }
    automaticallyGeneratePoToken(requestInit) {
        if (!this.poToken && !this.visitorData) {
            Log_1.Logger.debug('Since PoToken and VisitorData are <warning>not specified</warning>, they are generated <info>automatically</info>.');
            this.generatePoToken(requestInit)
                .then(({ poToken, visitorData }) => {
                this.poToken = poToken;
                this.visitorData = visitorData;
                FileCache.set('poToken', this.poToken || '', { ttl: 60 * 60 * 24 });
                FileCache.set('visitorData', this.visitorData || '', { ttl: 60 * 60 * 24 });
            })
                .catch(() => { });
        }
    }
    initializeOptions(options) {
        const INTERNAL_OPTIONS = { ...options, oauth2: this.oauth2 };
        INTERNAL_OPTIONS.hl = options.hl || this.hl;
        INTERNAL_OPTIONS.gl = options.gl || this.gl;
        INTERNAL_OPTIONS.rewriteRequest = options.rewriteRequest || this.rewriteRequest;
        INTERNAL_OPTIONS.poToken = options.poToken || this.poToken;
        INTERNAL_OPTIONS.disablePoTokenAutoGeneration = options.disablePoTokenAutoGeneration || this.disablePoTokenAutoGeneration;
        INTERNAL_OPTIONS.visitorData = options.visitorData || this.visitorData;
        INTERNAL_OPTIONS.includesPlayerAPIResponse = options.includesPlayerAPIResponse || this.includesPlayerAPIResponse;
        INTERNAL_OPTIONS.includesNextAPIResponse = options.includesNextAPIResponse || this.includesNextAPIResponse;
        INTERNAL_OPTIONS.includesOriginalFormatData = options.includesOriginalFormatData || this.includesOriginalFormatData;
        INTERNAL_OPTIONS.includesRelatedVideo = options.includesRelatedVideo || this.includesRelatedVideo;
        INTERNAL_OPTIONS.clients = options.clients || this.clients;
        INTERNAL_OPTIONS.disableDefaultClients = options.disableDefaultClients || this.disableDefaultClients;
        INTERNAL_OPTIONS.disableRetryRequest = options.disableRetryRequest || this.disableRetryRequest;
        INTERNAL_OPTIONS.oauth2Credentials = options.oauth2Credentials || this.oauth2?.getCredentials();
        INTERNAL_OPTIONS.parsesHLSFormat = options.parsesHLSFormat || this.parsesHLSFormat;
        INTERNAL_OPTIONS.originalProxy = options.originalProxy || this.originalProxy || undefined;
        /* Format Selection Options */
        INTERNAL_OPTIONS.quality = options.quality || this.quality || undefined;
        INTERNAL_OPTIONS.filter = options.filter || this.filter || undefined;
        INTERNAL_OPTIONS.excludingClients = options.excludingClients || this.excludingClients || [];
        INTERNAL_OPTIONS.includingClients = options.includingClients || this.includingClients || 'all';
        /* Download Options */
        INTERNAL_OPTIONS.range = options.range || this.range || undefined;
        INTERNAL_OPTIONS.begin = options.begin || this.begin || undefined;
        INTERNAL_OPTIONS.liveBuffer = options.liveBuffer || this.liveBuffer || undefined;
        INTERNAL_OPTIONS.highWaterMark = options.highWaterMark || this.highWaterMark || undefined;
        INTERNAL_OPTIONS.IPv6Block = options.IPv6Block || this.IPv6Block || undefined;
        INTERNAL_OPTIONS.dlChunkSize = options.dlChunkSize || this.dlChunkSize || undefined;
        INTERNAL_OPTIONS.html5Player = options.html5Player || this.html5Player || undefined;
        if (!INTERNAL_OPTIONS.oauth2 && options.oauth2Credentials) {
            INTERNAL_OPTIONS.oauth2 = new OAuth2_1.OAuth2(options.oauth2Credentials);
        }
        return INTERNAL_OPTIONS;
    }
    generatePoToken(requestInit = {}) {
        return new Promise((resolve, reject) => {
            const generatePoToken = Platform_1.Platform.getShim().poToken;
            generatePoToken(requestInit)
                .then((data) => {
                resolve(data);
            })
                .catch((err) => {
                reject(err);
            });
        });
    }
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    download(link, options = {}) {
        return (0, Download_1.download)(link, this.initializeOptions(options));
    }
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    downloadFromInfo(info, options = {}) {
        return (0, Download_1.downloadFromInfo)(info, this.initializeOptions(options));
    }
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    getBasicInfo(link, options = {}) {
        return (0, Info_1.getBasicInfo)(link, this.initializeOptions(options));
    }
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    getFullInfo(link, options = {}) {
        return (0, Info_1.getFullInfo)(link, this.initializeOptions(options));
    }
}
exports.YtdlCore = YtdlCore;
YtdlCore.chooseFormat = Format_1.FormatUtils.chooseFormat;
YtdlCore.filterFormats = Format_1.FormatUtils.filterFormats;
YtdlCore.decipherFormats = function (formats, html5Player) {
    return new Promise(async (resolve) => {
        const HTML5_PLAYER_DATA = await (0, Html5Player_1.getPlayerFunctions)({}, html5Player), SIGNATURE = new Signature_1.Signature();
        await SIGNATURE.getDecipherFunctions(HTML5_PLAYER_DATA);
        await SIGNATURE.getNTransform(HTML5_PLAYER_DATA);
        const DECIPHERED_FORMATS = formats.map((format) => SIGNATURE.decipherFormat(format));
        resolve(DECIPHERED_FORMATS);
    });
};
YtdlCore.toVideoFormats = function (formats, includesOriginalFormatData = false) {
    const FORMATS = formats.map((format) => Format_1.FormatUtils.addFormatMeta(format, includesOriginalFormatData));
    FORMATS.sort(Format_1.FormatUtils.sortFormats);
    return FORMATS;
};
YtdlCore.createOAuth2Credentials = OAuth2_1.OAuth2.createOAuth2Credentials;
YtdlCore.validateID = Url_1.Url.validateID;
YtdlCore.validateURL = Url_1.Url.validateURL;
YtdlCore.getURLVideoID = Url_1.Url.getURLVideoID;
YtdlCore.getVideoID = Url_1.Url.getVideoID;
//# sourceMappingURL=YtdlCore.js.map