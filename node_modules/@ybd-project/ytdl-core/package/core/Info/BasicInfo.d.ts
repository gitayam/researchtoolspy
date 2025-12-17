import { YT_StreamingAdaptiveFormat, YTDL_VideoInfo } from '../../types';
import { InternalDownloadOptions } from '../../core/types';
declare function _getBasicInfo(id: string, options: InternalDownloadOptions, isFromGetInfo: boolean): Promise<YTDL_VideoInfo<YT_StreamingAdaptiveFormat>>;
declare function getBasicInfo(link: string, options: InternalDownloadOptions): Promise<YTDL_VideoInfo<YT_StreamingAdaptiveFormat>>;
export { _getBasicInfo, getBasicInfo };
