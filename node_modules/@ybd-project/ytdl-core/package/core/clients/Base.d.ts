type RequestOptions = {
    payload: string;
    headers: Record<string, any>;
};
import type { YT_PlayerApiResponse, YTDL_InnertubeResponseInfo } from '../../types';
import type { UpperCaseClientTypes } from '../../types/_internal';
import type { ClientsParams } from './meta/Clients';
export default class Base {
    private static playError;
    static request<T = YT_PlayerApiResponse>(url: string, requestOptions: RequestOptions, params: ClientsParams, clientName: UpperCaseClientTypes | 'Next'): Promise<YTDL_InnertubeResponseInfo<T>>;
}
export {};
