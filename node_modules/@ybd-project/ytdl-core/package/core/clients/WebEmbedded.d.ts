import { ClientsParams } from './meta/Clients';
export default class WebEmbedded {
    static getPlayerResponse(params: ClientsParams): Promise<import("../../types").YTDL_InnertubeResponseInfo<import("../../types").YT_PlayerApiResponse>>;
}
