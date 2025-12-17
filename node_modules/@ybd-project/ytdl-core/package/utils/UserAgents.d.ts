type UserAgentType = 'desktop' | 'ios' | 'android' | 'tv';
declare class UserAgent {
    static default: string;
    static ios: string;
    static android: string;
    static tv: string;
    static getRandomUserAgent(type: UserAgentType): string;
}
export { UserAgent };
