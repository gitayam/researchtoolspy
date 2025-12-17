export declare abstract class YtdlCore_Cache {
    abstract get<T = unknown>(key: any): Promise<T | null>;
    abstract set(key: any, value: any, options?: any): Promise<boolean>;
    abstract has(key: string): Promise<boolean>;
    abstract delete(key: string): Promise<boolean>;
    abstract disable(): void;
    abstract initialization(): void;
}
export declare class CacheWithMap implements YtdlCore_Cache {
    private ttl;
    private cache;
    isDisabled: boolean;
    constructor(ttl?: number);
    get<T = unknown>(key: string): Promise<T | null>;
    set(key: string, value: any, { ttl }?: {
        ttl: number;
    }): Promise<boolean>;
    has(key: string): Promise<boolean>;
    delete(key: string): Promise<boolean>;
    disable(): void;
    initialization(): void;
}
