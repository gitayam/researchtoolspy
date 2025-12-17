declare class Url {
    static getBaseUrl(): string;
    static getPlayerJsUrl(playerId: string): string;
    static getWatchPageUrl(id: string): string;
    static getEmbedUrl(id: string): string;
    static getIframeApiUrl(): string;
    static getInnertubeBaseUrl(): string;
    static getTvUrl(): string;
    static getTokenApiUrl(): string;
    static getDeviceCodeApiUrl(): string;
    static validateID(id: string): boolean;
    static getURLVideoID(link: string): string;
    static getVideoID(str: string): string | null;
    static validateURL(str: string): boolean;
}
export { Url };
