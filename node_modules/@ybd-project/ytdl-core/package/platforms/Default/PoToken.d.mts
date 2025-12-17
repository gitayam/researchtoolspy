import { YTDL_ProxyOptions } from '../../types/index.js';
declare function generatePoToken(requestInit?: YTDL_ProxyOptions): Promise<{
    poToken: string;
    visitorData: string;
}>;
export { generatePoToken };
