import type { YTDL_VideoInfo } from '../../types';
import { InternalDownloadOptions } from '../../core/types';
declare function downloadFromInfo(info: YTDL_VideoInfo, options: InternalDownloadOptions): Promise<ReadableStream>;
declare function download(link: string, options: InternalDownloadOptions): Promise<ReadableStream>;
export { download, downloadFromInfo };
