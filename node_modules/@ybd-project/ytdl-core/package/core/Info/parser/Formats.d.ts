type YTDL_M3U8Data = {
    itag: number;
    url: string;
};
import type { YTDL_RequestOptions, YT_StreamingAdaptiveFormat, YT_PlayerApiResponse } from '../../../types';
export declare class FormatParser {
    static parseFormats(playerResponse: YT_PlayerApiResponse | null): Array<YT_StreamingAdaptiveFormat>;
    static getM3U8(url: string, options: YTDL_RequestOptions): Promise<Record<string, YTDL_M3U8Data>>;
    static parseAdditionalManifests(playerResponse: YT_PlayerApiResponse | null, options: YTDL_RequestOptions): Array<Promise<Record<string, YTDL_M3U8Data>>>;
}
export {};
