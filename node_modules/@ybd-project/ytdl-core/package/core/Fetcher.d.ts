import type { YTDL_RequestOptions } from '../types/Options';
declare class Fetcher {
    static fetch(url: string, options?: RequestInit, noProxyAdaptation?: boolean): Promise<Response>;
    static request<T = unknown>(url: string, { requestOptions, rewriteRequest, originalProxy }?: YTDL_RequestOptions): Promise<T>;
}
export { Fetcher };
