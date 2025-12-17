type NextApiResponses = {
    web: YT_NextApiResponse | null;
};
import type { YT_NextApiResponse } from '../../../types';
import type { ClientsParams } from '../../../core/types';
export default class NextApi {
    static getApiResponses(nextApiParams: ClientsParams): Promise<NextApiResponses>;
}
export {};
