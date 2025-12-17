import type { YT_NextApiResponse, YT_PlayerApiResponse, YTDL_InnertubeResponseInfo } from '../../../types';
import type { UpperCaseClientTypes } from '../../../types/_internal';
export default class ApiBase {
    static checkResponse<T = YT_PlayerApiResponse>(res: PromiseSettledResult<YTDL_InnertubeResponseInfo<YT_PlayerApiResponse | YT_NextApiResponse> | null>, client: UpperCaseClientTypes | 'Next'): YTDL_InnertubeResponseInfo<T> | null;
}
