import type { YTDL_OAuth2ClientData, YTDL_OAuth2Credentials } from '../types/Options';
export declare class OAuth2 {
    isEnabled: boolean;
    credentials: YTDL_OAuth2Credentials;
    accessToken: string;
    refreshToken: string;
    expiryDate: string;
    clientId?: string;
    clientSecret?: string;
    constructor(credentials: YTDL_OAuth2Credentials | null);
    private availableTokenCheck;
    private error;
    getClientData(): Promise<YTDL_OAuth2ClientData | null>;
    shouldRefreshToken(): boolean;
    refreshAccessToken(): Promise<void>;
    getAccessToken(): string;
    getCredentials(): YTDL_OAuth2Credentials;
    static createOAuth2Credentials(userOperationCallback?: (data: {
        verificationUrl: string;
        code: string;
    }) => void): Promise<YTDL_OAuth2Credentials | null>;
}
