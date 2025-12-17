import type { Html5PlayerCache, YT_StreamingAdaptiveFormat } from '../types';
import type { YTDL_DecipherFunction, YTDL_NTransformFunction } from '../types/Html5Player';
declare class Signature {
    decipherFunction: YTDL_DecipherFunction | null;
    nTransformFunction: YTDL_NTransformFunction | null;
    static getSignatureTimestamp(body?: string): string;
    decipherFormat(format: YT_StreamingAdaptiveFormat<false>): YT_StreamingAdaptiveFormat<true>;
    decipherFormats(formats: Array<YT_StreamingAdaptiveFormat>): Record<string, YT_StreamingAdaptiveFormat>;
    getDecipherFunctions({ id, body }: Html5PlayerCache): Promise<YTDL_DecipherFunction | Html5PlayerCache>;
    getNTransform({ id, body }: Html5PlayerCache): Promise<YTDL_NTransformFunction | Html5PlayerCache>;
}
export { Signature };
