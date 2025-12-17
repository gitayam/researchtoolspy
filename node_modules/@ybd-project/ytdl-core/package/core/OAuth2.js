"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OAuth2 = void 0;
const Platform_1 = require("../platforms/Platform");
const Log_1 = require("../utils/Log");
const Url_1 = require("../utils/Url");
const UserAgents_1 = require("../utils/UserAgents");
const clients_1 = require("./clients");
const Fetcher_1 = require("./Fetcher");
/* Reference: LuanRT/YouTube.js */
const REGEX = { tvScript: new RegExp('<script\\s+id="base-js"\\s+src="([^"]+)"[^>]*><\\/script>'), clientIdentity: new RegExp('clientId:"(?<client_id>[^"]+)",[^"]*?:"(?<client_secret>[^"]+)"') }, FileCache = Platform_1.Platform.getShim().fileCache;
class OAuth2 {
    constructor(credentials) {
        this.isEnabled = false;
        this.credentials = {
            accessToken: '',
            refreshToken: '',
            expiryDate: '',
        };
        this.accessToken = '';
        this.refreshToken = '';
        this.expiryDate = '';
        if (!credentials) {
            this.isEnabled = false;
            return;
        }
        this.isEnabled = true;
        this.credentials = credentials;
        this.accessToken = credentials.accessToken;
        this.refreshToken = credentials.refreshToken;
        this.expiryDate = credentials.expiryDate;
        this.clientId = credentials.clientData?.clientId;
        this.clientSecret = credentials.clientData?.clientSecret;
        if (this.shouldRefreshToken()) {
            try {
                this.refreshAccessToken().finally(() => this.availableTokenCheck());
            }
            catch { }
        }
        else {
            this.availableTokenCheck();
        }
        FileCache.set('oauth2', JSON.stringify(credentials));
    }
    async availableTokenCheck() {
        try {
            const HTML5_PLAYER_CACHE = await FileCache.get('html5Player');
            clients_1.Web.getPlayerResponse({
                videoId: 'dQw4w9WgXcQ',
                signatureTimestamp: parseInt(HTML5_PLAYER_CACHE?.signatureTimestamp || '0') || 0,
                options: {
                    oauth2: this,
                },
            })
                .then(() => Log_1.Logger.debug('The specified OAuth2 token is valid.'))
                .catch((err) => {
                if (err.error.message.includes('401')) {
                    this.error('Request using the specified token failed (Web Client). Generating the token again may fix the problem.');
                }
            });
        }
        catch (err) {
            if ((err.message || err.error.message).includes('401')) {
                this.error('Request using the specified token failed (Web Client). Generating the token again may fix the problem.');
            }
        }
    }
    error(message) {
        Log_1.Logger.error(message);
        Log_1.Logger.info('OAuth2 is disabled due to an error.');
        this.isEnabled = false;
    }
    async getClientData() {
        const OAUTH2_CACHE = (await FileCache.get('oauth2')) || {};
        if (OAUTH2_CACHE.clientData?.clientId && OAUTH2_CACHE.clientData?.clientSecret) {
            return {
                clientId: OAUTH2_CACHE.clientData.clientId,
                clientSecret: OAUTH2_CACHE.clientData.clientSecret,
            };
        }
        const HEADERS = {
            'User-Agent': UserAgents_1.UserAgent.tv,
            Referer: Url_1.Url.getTvUrl(),
        }, YT_TV_RESPONSE = await Fetcher_1.Fetcher.fetch(Url_1.Url.getTvUrl(), {
            headers: HEADERS,
        });
        if (!YT_TV_RESPONSE.ok) {
            this.error('Failed to get client data: ' + YT_TV_RESPONSE.status);
            return null;
        }
        const YT_TV_HTML = await YT_TV_RESPONSE.text(), SCRIPT_PATH = REGEX.tvScript.exec(YT_TV_HTML)?.[1];
        if (SCRIPT_PATH) {
            Log_1.Logger.debug('Found YouTube TV script: ' + SCRIPT_PATH);
            const SCRIPT_RESPONSE = await Fetcher_1.Fetcher.fetch(Url_1.Url.getBaseUrl() + SCRIPT_PATH, { headers: HEADERS });
            if (!SCRIPT_RESPONSE.ok) {
                this.error('TV script request failed with status code: ' + SCRIPT_RESPONSE.status);
                return null;
            }
            const SCRIPT_STRING = await SCRIPT_RESPONSE.text(), CLIENT_ID = REGEX.clientIdentity.exec(SCRIPT_STRING)?.groups?.client_id, CLIENT_SECRET = REGEX.clientIdentity.exec(SCRIPT_STRING)?.groups?.client_secret;
            if (!CLIENT_ID || !CLIENT_SECRET) {
                this.error("Could not obtain client ID. Please create an issue in the repository for possible specification changes on YouTube's side.");
                return null;
            }
            Log_1.Logger.debug('Found client ID: ' + CLIENT_ID);
            Log_1.Logger.debug('Found client secret: ' + CLIENT_SECRET);
            return { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET };
        }
        this.error("Could not obtain script URL. Please create an issue in the repository for possible specification changes on YouTube's side.");
        return null;
    }
    shouldRefreshToken() {
        if (!this.isEnabled) {
            return false;
        }
        return Date.now() >= new Date(this.expiryDate).getTime();
    }
    async refreshAccessToken() {
        if (!this.isEnabled) {
            return;
        }
        if (!this.clientId || !this.clientSecret) {
            const data = await this.getClientData();
            if (!data) {
                return;
            }
            this.clientId = data.clientId;
            this.clientSecret = data.clientSecret;
            FileCache.set('oauth2', JSON.stringify({ accessToken: this.accessToken, refreshToken: this.refreshToken, expiryDate: this.expiryDate, clientData: { clientId: data.clientId, clientSecret: data.clientSecret } }));
        }
        if (!this.refreshToken) {
            return this.error('Refresh token is missing, make sure it is specified.');
        }
        try {
            const PAYLOAD = {
                client_id: this.clientId,
                client_secret: this.clientSecret,
                refresh_token: this.refreshToken,
                grant_type: 'refresh_token',
            }, REFRESH_API_RESPONSE = await Fetcher_1.Fetcher.fetch(Url_1.Url.getTokenApiUrl(), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(PAYLOAD),
            });
            if (!REFRESH_API_RESPONSE.ok) {
                return this.error(`Failed to refresh access token: ${REFRESH_API_RESPONSE.status}`);
            }
            const REFRESH_API_DATA = (await REFRESH_API_RESPONSE.json());
            if (REFRESH_API_DATA.error_code) {
                return this.error('Authorization server returned an error: ' + JSON.stringify(REFRESH_API_DATA));
            }
            this.expiryDate = new Date(Date.now() + REFRESH_API_DATA.expires_in * 1000).toISOString();
            this.accessToken = REFRESH_API_DATA.access_token;
        }
        catch (err) {
            this.error(err.message);
        }
    }
    getAccessToken() {
        return this.accessToken;
    }
    getCredentials() {
        return this.credentials;
    }
    static async createOAuth2Credentials(userOperationCallback) {
        return new Promise(async (resolve) => {
            const CACHE = await FileCache.get('oauth2');
            console.log(CACHE);
            if (CACHE) {
                return resolve(CACHE);
            }
            const OAUTH2 = new OAuth2(null);
            function errorHandle() {
                resolve(null);
            }
            function generateUuidV4() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    const r = (Math.random() * 16) | 0, v = c == 'x' ? r : (r & 0x3) | 0x8;
                    return v.toString(16);
                });
            }
            OAUTH2.getClientData()
                .then((data) => {
                if (!data) {
                    return resolve(null);
                }
                const { clientId, clientSecret } = data;
                Fetcher_1.Fetcher.fetch(Url_1.Url.getDeviceCodeApiUrl(), {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ client_id: clientId, scope: 'http://gdata.youtube.com https://www.googleapis.com/auth/youtube-paid-content', device_id: generateUuidV4(), device_model: 'ytlr::' }),
                })
                    .then((response) => response.json())
                    .then((deviceApiResponse) => {
                    if (deviceApiResponse.error || deviceApiResponse.error_code) {
                        Log_1.Logger.error('[ OAuth2 ]: The OAuth2 credential could not be generated because of failure to obtain the device code.');
                        return errorHandle();
                    }
                    Log_1.Logger.info(`[ OAuth2 ]: Please open the following URL and follow the instructions: <debug>${deviceApiResponse.verification_url}</debug>`);
                    Log_1.Logger.info(`[ OAuth2 ]: Please enter the following code: <warning>${deviceApiResponse.user_code}</warning>`);
                    if (typeof userOperationCallback === 'function') {
                        userOperationCallback({ verificationUrl: deviceApiResponse.verification_url, code: deviceApiResponse.user_code });
                    }
                    const BODY = JSON.stringify({
                        client_id: clientId,
                        client_secret: clientSecret,
                        code: deviceApiResponse.device_code,
                        grant_type: 'http://oauth.net/grant_type/device/1.0',
                    }), REQUEST_INTERVAL = setInterval(async () => {
                        const RESPONSE = await (await Fetcher_1.Fetcher.fetch(Url_1.Url.getTokenApiUrl(), {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: BODY,
                        })).json();
                        if (RESPONSE.error) {
                            switch (RESPONSE.error) {
                                case 'authorization_pending':
                                case 'slow_down':
                                    Log_1.Logger.debug('[ OAuth2 ]: Polling for access token...');
                                    break;
                                case 'access_denied': {
                                    Log_1.Logger.error('[ OAuth2 ]: Generation of OAuth2 credentials failed because access to the API was forbidden.');
                                    resolve(null);
                                    clearInterval(REQUEST_INTERVAL);
                                    break;
                                }
                                case 'expired_token': {
                                    Log_1.Logger.error('[ OAuth2 ]: OAuth2 credential generation failed because the device code has expired.');
                                    resolve(null);
                                    clearInterval(REQUEST_INTERVAL);
                                    break;
                                }
                                default: {
                                    Log_1.Logger.error('[ OAuth2 ]: OAuth2 credential generation failed because the API responded with the following error code:' + RESPONSE.error);
                                    resolve(null);
                                    clearInterval(REQUEST_INTERVAL);
                                    break;
                                }
                            }
                            return;
                        }
                        Log_1.Logger.debug(`[ OAuth2 ]: Success to obtain access token: <success>${RESPONSE.access_token}</success>`);
                        resolve({
                            accessToken: RESPONSE.access_token,
                            refreshToken: RESPONSE.refresh_token,
                            expiryDate: new Date(Date.now() + RESPONSE.expires_in * 1000).toISOString(),
                            clientData: {
                                clientId,
                                clientSecret,
                            },
                        });
                        clearInterval(REQUEST_INTERVAL);
                    }, deviceApiResponse.interval * 1000);
                })
                    .catch(errorHandle);
            })
                .catch(errorHandle);
        });
    }
}
exports.OAuth2 = OAuth2;
//# sourceMappingURL=OAuth2.js.map