import { ClientsParams } from './meta/Clients';
export default class Web {
    static getPlayerResponse(params: ClientsParams): Promise<import("../../types").YTDL_InnertubeResponseInfo<import("../../types").YT_PlayerApiResponse>>;
    static getNextResponse(params: ClientsParams): Promise<import("../../types").YTDL_InnertubeResponseInfo<import("../../types").YT_PlayerApiResponse>>;
}
