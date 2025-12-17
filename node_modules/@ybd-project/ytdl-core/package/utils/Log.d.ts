export declare class Logger {
    static logDisplay: Array<'debug' | 'info' | 'success' | 'warning' | 'error'>;
    static outputControlCharacter: {
        red: string;
        green: string;
        yellow: string;
        blue: string;
        magenta: string;
        reset: string;
    };
    private static replaceColorTags;
    private static convertMessage;
    private static convertMessages;
    static initialization(): void;
    static debug(...messages: Array<any>): void;
    static info(...messages: Array<any>): void;
    static success(...messages: Array<any>): void;
    static warning(...messages: Array<any>): void;
    static error(...messages: Array<any>): void;
}
