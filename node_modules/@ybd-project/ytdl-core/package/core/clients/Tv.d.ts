import { ClientsParams } from './meta/Clients';
export default class Tv {
    static getPlayerResponse(params: ClientsParams): Promise<import("../../types").YTDL_InnertubeResponseInfo<import("../../types").YT_PlayerApiResponse>>;
}
