import type { YT_StreamingAdaptiveFormat, YTDL_ClientTypes, YTDL_VideoFormat, YTDL_ChooseFormatOptions } from '../types';
declare class FormatUtils {
    static sortFormats(a: Object, b: Object): number;
    static filterFormats(formats: Array<YTDL_VideoFormat>, filter?: YTDL_ChooseFormatOptions['filter']): Array<YTDL_VideoFormat>;
    static chooseFormat(formats: Array<YTDL_VideoFormat>, options: YTDL_ChooseFormatOptions): YTDL_VideoFormat;
    static getClientName(url: string): YTDL_ClientTypes | 'unknown';
    static addFormatMeta(adaptiveFormat: YT_StreamingAdaptiveFormat<any>, includesOriginalFormatData: boolean): YTDL_VideoFormat;
}
export { FormatUtils };
