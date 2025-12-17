import type { YTDL_Constructor, YTDL_DownloadOptions, YTDL_GetInfoOptions, YTDL_VideoInfo, YTDL_ProxyOptions, YT_StreamingAdaptiveFormat, YTDL_VideoFormat } from './types';
import { OAuth2 } from './core/OAuth2';
import { Url } from './utils/Url';
import { FormatUtils } from './utils/Format';
declare class YtdlCore {
    static chooseFormat: typeof FormatUtils.chooseFormat;
    static filterFormats: typeof FormatUtils.filterFormats;
    static decipherFormats: (formats: Array<YT_StreamingAdaptiveFormat<false>>, html5Player?: YTDL_DownloadOptions["html5Player"]) => Promise<Array<YT_StreamingAdaptiveFormat<true>>>;
    static toVideoFormats: (formats: Array<YT_StreamingAdaptiveFormat<any>>, includesOriginalFormatData?: boolean) => Array<YTDL_VideoFormat>;
    static createOAuth2Credentials: typeof OAuth2.createOAuth2Credentials;
    static validateID: typeof Url.validateID;
    static validateURL: typeof Url.validateURL;
    static getURLVideoID: typeof Url.getURLVideoID;
    static getVideoID: typeof Url.getVideoID;
    hl: YTDL_DownloadOptions['hl'];
    gl: YTDL_DownloadOptions['gl'];
    rewriteRequest: YTDL_GetInfoOptions['rewriteRequest'];
    poToken: YTDL_DownloadOptions['poToken'];
    disablePoTokenAutoGeneration: YTDL_DownloadOptions['disablePoTokenAutoGeneration'];
    visitorData: YTDL_DownloadOptions['visitorData'];
    includesPlayerAPIResponse: YTDL_DownloadOptions['includesPlayerAPIResponse'];
    includesNextAPIResponse: YTDL_DownloadOptions['includesNextAPIResponse'];
    includesOriginalFormatData: YTDL_DownloadOptions['includesOriginalFormatData'];
    includesRelatedVideo: YTDL_DownloadOptions['includesRelatedVideo'];
    clients: YTDL_DownloadOptions['clients'];
    disableDefaultClients: YTDL_DownloadOptions['disableDefaultClients'];
    disableRetryRequest: YTDL_DownloadOptions['disableRetryRequest'];
    oauth2: OAuth2 | null;
    parsesHLSFormat: YTDL_DownloadOptions['parsesHLSFormat'];
    originalProxy: YTDL_DownloadOptions['originalProxy'];
    quality: YTDL_DownloadOptions['quality'] | undefined;
    filter: YTDL_DownloadOptions['filter'] | undefined;
    excludingClients: YTDL_DownloadOptions['excludingClients'];
    includingClients: YTDL_DownloadOptions['includingClients'];
    range: YTDL_DownloadOptions['range'] | undefined;
    begin: YTDL_DownloadOptions['begin'] | undefined;
    liveBuffer: YTDL_DownloadOptions['liveBuffer'] | undefined;
    highWaterMark: YTDL_DownloadOptions['highWaterMark'] | undefined;
    IPv6Block: YTDL_DownloadOptions['IPv6Block'] | undefined;
    dlChunkSize: YTDL_DownloadOptions['dlChunkSize'] | undefined;
    html5Player: YTDL_DownloadOptions['html5Player'] | undefined;
    version: string;
    constructor({ hl, gl, rewriteRequest, poToken, disablePoTokenAutoGeneration, visitorData, includesPlayerAPIResponse, includesNextAPIResponse, includesOriginalFormatData, includesRelatedVideo, clients, disableDefaultClients, disableRetryRequest, oauth2Credentials, parsesHLSFormat, originalProxy, quality, filter, excludingClients, includingClients, range, begin, liveBuffer, highWaterMark, IPv6Block, dlChunkSize, html5Player, disableBasicCache, disableFileCache, fetcher, logDisplay, noUpdate, disableInitialSetup }?: YTDL_Constructor);
    private init;
    private setPoToken;
    private setVisitorData;
    private setOAuth2;
    private automaticallyGeneratePoToken;
    private initializeOptions;
    generatePoToken(requestInit?: YTDL_ProxyOptions): Promise<{
        poToken: string;
        visitorData: string;
    }>;
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    download(link: string, options?: YTDL_DownloadOptions): Promise<ReadableStream>;
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    downloadFromInfo(info: YTDL_VideoInfo, options?: YTDL_DownloadOptions): Promise<ReadableStream>;
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    getBasicInfo(link: string, options?: YTDL_DownloadOptions): Promise<YTDL_VideoInfo<YT_StreamingAdaptiveFormat>>;
    /** TIP: The options specified in new YtdlCore() are applied by default. (The function arguments specified will take precedence.) */
    getFullInfo(link: string, options?: YTDL_DownloadOptions): Promise<YTDL_VideoInfo>;
}
export { YtdlCore };
