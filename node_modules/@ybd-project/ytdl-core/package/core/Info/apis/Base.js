"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Log_1 = require("../../../utils/Log");
class ApiBase {
    static checkResponse(res, client) {
        try {
            if (res.status === 'fulfilled') {
                if (res.value === null) {
                    return null;
                }
                Log_1.Logger.debug(`[ ${client} ]: <success>Success</success>`);
                return Object.assign({}, res.value);
            }
            else {
                const REASON = res.reason || {};
                Log_1.Logger.debug(`[ ${client} ]: <error>Error</error> (Reason: <error>${REASON.error?.message || REASON.error?.toString()}</error>)`);
                return REASON;
            }
        }
        catch (err) {
            return (res || {})?.reason;
        }
    }
}
exports.default = ApiBase;
//# sourceMappingURL=Base.js.map