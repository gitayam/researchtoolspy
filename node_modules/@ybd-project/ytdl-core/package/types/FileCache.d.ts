import { YTDL_DecipherFunction, YTDL_NTransformFunction } from './Html5Player';
export type PoTokenCache = string;
export type VisitorDataCache = string;
export type OAuth2Cache = {
    accessToken: string;
    refreshToken: string;
    expiryDate: string;
    clientData: {
        clientId: string;
        clientSecret: string;
    };
};
export type Html5PlayerCache = {
    id: string;
    body: string;
    signatureTimestamp: string;
    functions: {
        decipher: YTDL_DecipherFunction;
        nTransform: YTDL_NTransformFunction;
    };
};
