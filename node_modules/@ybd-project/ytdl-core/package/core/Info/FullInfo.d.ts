import { InternalDownloadOptions } from '../../core/types';
import { YTDL_VideoInfo } from '../../types';
declare function getFullInfo(link: string, options: InternalDownloadOptions): Promise<YTDL_VideoInfo>;
export { getFullInfo };
