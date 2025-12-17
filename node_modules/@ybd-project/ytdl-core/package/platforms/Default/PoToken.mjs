import { JSDOM } from 'jsdom';
import { BG } from 'bgutils-js';
import { fetch } from 'undici';
import NextApi from '../../core/Info/apis/Next.js';
import { Logger } from '../../utils/Log.js';
const DOM = new JSDOM(), BG_CONFIG = {
    fetch: fetch,
    globalObj: globalThis,
    identifier: '',
    requestKey: 'O43z0dpjhgX20SCx4KAo',
};
Object.assign(globalThis, {
    window: DOM.window,
    document: DOM.window.document,
});
function initialization({ originalProxy, rewriteRequest }) {
    return new Promise((resolve) => {
        NextApi.default
            .getApiResponses({
            videoId: 'dQw4w9WgXcQ',
            signatureTimestamp: 0,
            options: {
                oauth2: null,
                originalProxy,
                rewriteRequest,
            },
        })
            .then((data) => {
            BG_CONFIG.identifier = data.web?.responseContext.visitorData || '';
            Logger.debug('[ PoToken ]: VisitorData was <success>successfully</success> retrieved.');
        })
            .catch(() => {
            Logger.debug('[ PoToken ]: <error>Failed</error> to retrieve VisitorData.');
        })
            .finally(() => resolve(0));
    });
}
function generatePoToken(requestInit) {
    return new Promise(async (resolve) => {
        const { originalProxy, rewriteRequest } = requestInit || {};
        await initialization({ originalProxy, rewriteRequest });
        BG_CONFIG.fetch = (url, options) => {
            url = url.toString();
            if (typeof rewriteRequest === 'function') {
                const { url: newUrl, options: newOptions } = rewriteRequest(url, options || {}, {
                    isDownloadUrl: false,
                });
                url = newUrl;
                options = newOptions;
            }
            if (originalProxy) {
                try {
                    const PARSED = new URL(originalProxy.base);
                    if (!url.includes(PARSED.host)) {
                        url = `${PARSED.protocol}//${PARSED.host}/?${originalProxy.urlQueryName || 'url'}=${encodeURIComponent(url)}`;
                    }
                }
                catch { }
            }
            return fetch(url, options);
        };
        if (!BG_CONFIG.identifier) {
            resolve({
                poToken: '',
                visitorData: '',
            });
        }
        const CHALLENGE = await BG.Challenge.create(BG_CONFIG);
        if (!CHALLENGE) {
            resolve({
                poToken: '',
                visitorData: '',
            });
            return;
        }
        const INTERPRETER_JAVASCRIPT = CHALLENGE.interpreterJavascript.privateDoNotAccessOrElseSafeScriptWrappedValue;
        if (INTERPRETER_JAVASCRIPT) {
            new Function(INTERPRETER_JAVASCRIPT)();
        }
        else {
            Logger.debug('<warning>Unable to load VM.</warning>');
            resolve({
                poToken: '',
                visitorData: '',
            });
            return;
        }
        const PO_TOKEN = (await BG.PoToken.generate({
            program: CHALLENGE.program,
            globalName: CHALLENGE.globalName,
            bgConfig: BG_CONFIG,
        })).poToken;
        Logger.debug(`[ PoToken ]: <success>Successfully</success> generated a poToken. (${PO_TOKEN})`);
        resolve({
            poToken: PO_TOKEN || '',
            visitorData: BG_CONFIG.identifier,
        });
    });
}
export { generatePoToken };
//# sourceMappingURL=PoToken.mjs.map