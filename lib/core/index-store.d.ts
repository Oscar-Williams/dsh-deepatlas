import { AtlasIndex } from '../types.js';
export declare const SCHEMA_VERSION = 1;
export declare function defaultDataDir(explicit?: string): string;
export declare class IndexStore {
    private readonly filePath;
    constructor(dataDir: string);
    get location(): string;
    load(): Promise<AtlasIndex | null>;
    save(index: AtlasIndex): Promise<void>;
    /** 索引是否已过期(TTL 小时) */
    isStale(index: AtlasIndex, ttlHours: number): boolean;
}
