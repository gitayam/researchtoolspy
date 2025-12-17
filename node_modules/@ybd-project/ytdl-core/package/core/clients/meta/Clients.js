"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Clients = void 0;
const General_1 = __importDefault(require("../../../utils/General"));
const UserAgents_1 = require("../../../utils/UserAgents");
const Url_1 = require("../../../utils/Url");
const INNERTUBE_BASE_API_URL = Url_1.Url.getInnertubeBaseUrl(), INNERTUBE_CLIENTS = Object.freeze({
    web: {
        context: {
            client: {
                clientName: 'WEB',
                clientVersion: '2.20240726.00.00',
                userAgent: UserAgents_1.UserAgent.default,
            },
        },
        clientName: 1,
        apiInfo: {
            key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        },
    },
    webCreator: {
        context: {
            client: {
                clientName: 'WEB_CREATOR',
                clientVersion: '1.20240918.03.00',
                userAgent: UserAgents_1.UserAgent.default,
            },
        },
        clientName: 62,
        apiInfo: {
            key: 'AIzaSyBUPetSUmoZL-OhlxA7wSac5XinrygCqMo',
        },
    },
    webEmbedded: {
        context: {
            client: {
                clientName: 'WEB_EMBEDDED_PLAYER',
                clientVersion: '2.20240111.09.00',
                userAgent: UserAgents_1.UserAgent.default,
                clientScreen: 'EMBED',
            },
        },
        clientName: 56,
        apiInfo: {
            key: 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
        },
    },
    android: {
        context: {
            client: {
                clientName: 'ANDROID',
                clientVersion: '19.35.36',
                androidSdkVersion: 33,
                userAgent: UserAgents_1.UserAgent.android,
                osName: 'Android',
                osVersion: '13',
            },
        },
        clientName: 3,
        apiInfo: {
            key: 'AIzaSyA8eiZmM1FaDVjRy-df2KTyQ_vz_yYM39w',
        },
    },
    ios: {
        context: {
            client: {
                clientName: 'IOS',
                clientVersion: '19.29.1',
                deviceMake: 'Apple',
                deviceModel: 'iPhone16,2',
                userAgent: UserAgents_1.UserAgent.ios,
                osName: 'iPhone',
                osVersion: '17.5.1.21F90',
            },
        },
        clientName: 5,
        apiInfo: {
            key: 'AIzaSyB-63vPrdThhKuerbB2N_l7Kwwcxj6yUAc',
        },
    },
    mweb: {
        context: {
            client: {
                clientName: 'MWEB',
                clientVersion: '2.20240726.01.00',
                userAgent: UserAgents_1.UserAgent.default,
            },
        },
        clientName: 2,
        apiInfo: {},
    },
    tv: {
        context: {
            client: {
                clientName: 'TVHTML5',
                clientVersion: '7.20241016.15.00',
                userAgent: UserAgents_1.UserAgent.tv,
            },
        },
        clientName: 7,
        apiInfo: {},
    },
    tvEmbedded: {
        context: {
            client: {
                clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
                clientVersion: '2.0',
                userAgent: UserAgents_1.UserAgent.tv,
            },
            thirdParty: {
                embedUrl: 'https://www.youtube.com/',
            },
        },
        clientName: 85,
        apiInfo: {},
    },
}), INNERTUBE_BASE_PAYLOAD = {
    videoId: '',
    cpn: General_1.default.generateClientPlaybackNonce(16),
    contentCheckOk: true,
    racyCheckOk: true,
    serviceIntegrityDimensions: {},
    playbackContext: {
        contentPlaybackContext: {
            vis: 0,
            splay: false,
            referer: '',
            currentUrl: '',
            autonavState: 'STATE_ON',
            autoCaptionsDefaultOn: false,
            html5Preference: 'HTML5_PREF_WANTS',
            lactMilliseconds: '-1',
            signatureTimestamp: 0,
        },
    },
    attestationRequest: {
        omitBotguardData: true,
    },
    context: {
        client: {},
        request: {
            useSsl: true,
            internalExperimentFlags: [],
            consistencyTokenJars: [],
        },
        user: {
            lockedSafetyMode: false,
        },
    },
};
class Clients {
    static getAuthorizationHeader(oauth2) {
        return oauth2 && oauth2.isEnabled ? { authorization: 'Bearer ' + oauth2.getAccessToken(), 'X-Goog-AuthUser': '0' } : {};
    }
    static web({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.web, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?key=${CLIENT.apiInfo.key}&prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static web_nextApi({ videoId, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.web, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD, autonavState: 'STATE_OFF', playbackContext: { vis: 0, lactMilliseconds: '-1' }, captionsRequested: false };
        PAYLOAD.videoId = videoId;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL + '/next'}?key=${CLIENT.apiInfo.key}&prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static webCreator({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.webCreator, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?key=${CLIENT.apiInfo.key}&prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static webEmbedded({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.webEmbedded, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?key=${CLIENT.apiInfo.key}&prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static android({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.android, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?key=${CLIENT.apiInfo.key}&prettyPrint=false&id=${videoId}&t=${General_1.default.generateClientPlaybackNonce(12)}`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static ios({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.ios, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?key=${CLIENT.apiInfo.key}&prettyPrint=false&id=${videoId}&t=${General_1.default.generateClientPlaybackNonce(12)}`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static mweb({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.mweb, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static tv({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.tv, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
    static tvEmbedded({ videoId, signatureTimestamp, options: { poToken, visitorData, oauth2, hl, gl } }) {
        const CLIENT = INNERTUBE_CLIENTS.tvEmbedded, PAYLOAD = { ...INNERTUBE_BASE_PAYLOAD };
        PAYLOAD.videoId = videoId;
        PAYLOAD.playbackContext.contentPlaybackContext.signatureTimestamp = signatureTimestamp;
        PAYLOAD.context.client = CLIENT.context.client;
        PAYLOAD.context.client.hl = hl || 'en';
        PAYLOAD.context.client.gl = gl || 'US';
        if (poToken) {
            PAYLOAD.serviceIntegrityDimensions.poToken = poToken;
        }
        else {
            PAYLOAD.serviceIntegrityDimensions = undefined;
        }
        if (visitorData) {
            PAYLOAD.context.client.visitorData = visitorData;
        }
        return {
            url: `${INNERTUBE_BASE_API_URL}/player?prettyPrint=false`,
            payload: PAYLOAD,
            headers: {
                'X-YouTube-Client-Name': CLIENT.clientName,
                'X-Youtube-Client-Version': CLIENT.context.client.clientVersion,
                'X-Goog-Visitor-Id': visitorData,
                'User-Agent': CLIENT.context.client.userAgent,
                ...Clients.getAuthorizationHeader(oauth2),
            },
        };
    }
}
exports.Clients = Clients;
//# sourceMappingURL=Clients.js.map