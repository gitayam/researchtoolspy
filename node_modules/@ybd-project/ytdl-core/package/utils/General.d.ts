/** Extract string inbetween another */
declare function between(haystack: string, left: RegExp | string, right: string): string;
declare function tryParseBetween<T = unknown>(body: string, left: RegExp | string, right: string, prepend?: string, append?: string): T | null;
/** Get a number from an abbreviated number string. */
declare function parseAbbreviatedNumber(string: string): number | null;
/** Match begin and end braces of input JS, return only JS */
declare function cutAfterJS(mixedJson: string): string;
declare function getPropInsensitive<T = unknown>(obj: any, prop: string): T;
declare function setPropInsensitive(obj: any, prop: string, value: any): string | null;
declare function generateClientPlaybackNonce(length: number): string;
declare let lastUpdateCheck: number;
declare function checkForUpdates(): void;
export { between, tryParseBetween, parseAbbreviatedNumber, cutAfterJS, lastUpdateCheck, checkForUpdates, getPropInsensitive, setPropInsensitive, generateClientPlaybackNonce };
declare const _default: {
    between: typeof between;
    tryParseBetween: typeof tryParseBetween;
    parseAbbreviatedNumber: typeof parseAbbreviatedNumber;
    cutAfterJS: typeof cutAfterJS;
    lastUpdateCheck: number;
    checkForUpdates: typeof checkForUpdates;
    getPropInsensitive: typeof getPropInsensitive;
    setPropInsensitive: typeof setPropInsensitive;
    generateClientPlaybackNonce: typeof generateClientPlaybackNonce;
};
export default _default;
