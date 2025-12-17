"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toPipeableStream = toPipeableStream;
const stream_1 = require("stream");
/** Reference: LuanRT/YouTube.js - Utils.ts */
async function* streamToIterable(stream) {
    const READER = stream.getReader();
    try {
        while (true) {
            const { done, value } = await READER.read();
            if (done) {
                return;
            }
            yield value;
        }
    }
    finally {
        READER.releaseLock();
    }
}
function toPipeableStream(stream) {
    return stream_1.Readable.from(streamToIterable(stream));
}
//# sourceMappingURL=Readable.js.map