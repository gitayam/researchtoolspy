import type { YTDL_DownloadOptions, YTDL_GetInfoOptions } from '../../../types/Options';
import type { Html5PlayerCache } from '../../../types';
declare function getPlayerFunctions(options: YTDL_GetInfoOptions, html5Player: YTDL_DownloadOptions['html5Player']): Promise<Html5PlayerCache>;
export { getPlayerFunctions };
