import { YTDL_DownloadOptions } from '../types';
import { YtdlCore_Cache } from './utils/Classes';
import { YTDL_ProxyOptions } from '../types';
type YtdlCore_Shim = {
    runtime: 'default' | 'browser' | 'serverless';
    server: boolean;
    cache: YtdlCore_Cache;
    fileCache: YtdlCore_Cache;
    fetcher: (url: URL | RequestInfo, options?: RequestInit) => Promise<Response>;
    poToken: (requestInit?: YTDL_ProxyOptions) => Promise<{
        poToken: string;
        visitorData: string;
    }>;
    options: {
        download: YTDL_DownloadOptions;
        other: {
            logDisplay: Array<'debug' | 'info' | 'success' | 'warning' | 'error'>;
            noUpdate: boolean;
        };
    };
    requestRelated: {
        rewriteRequest: YTDL_DownloadOptions['rewriteRequest'];
        originalProxy: YTDL_DownloadOptions['originalProxy'] | null;
    };
    info: {
        version: string;
        repo: {
            user: string;
            name: string;
        };
        issuesUrl: string;
    };
    polyfills: {
        Headers: typeof Headers;
        ReadableStream: typeof ReadableStream;
        eval: typeof eval;
    };
};
export declare class Platform {
    #private;
    static load(shim: YtdlCore_Shim): void;
    static getShim(): YtdlCore_Shim;
}
export {};
