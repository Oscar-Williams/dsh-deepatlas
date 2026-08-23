/**
 * 生态扫描器(M1/P1):编排各数据源 → 去重合并 → 白名单标记 → 评分 → 落盘
 *
 * P1 新增:
 * - 增量模式(incremental):基于上次 builtAt 只抓更新,与旧索引合并;
 * - 类型精判(enrichTopN):对 star 靠前的仓库读文件清单判定类型;
 * - 进度回调(onProgress)透传到 CLI。
 * 降级链:github-topic 失败 → awesome-list 兜底;全部失败 → 保留旧索引。
 */
import { AtlasIndex, PluginType, SourceHealth } from '../types.js';
import { EcosystemSource } from './sources/types.js';
import { IndexStore } from './index-store.js';
export interface ScanProgress {
    sourceId: string;
    message: string;
}
export interface ScanOptions {
    token?: string;
    /** 增量模式:基于上次索引 builtAt 合并;无旧索引时自动退化为全量 */
    incremental?: boolean;
    /** 类型精判的仓库数上限(按 star 排序取头部),0 = 跳过精判 */
    enrichTopN?: number;
    /** 仅供测试注入:替换默认数据源 */
    sources?: EcosystemSource[];
    onProgress?: (p: ScanProgress) => void;
}
export declare class Scanner {
    private readonly store;
    private readonly sources;
    constructor(store: IndexStore, sources?: EcosystemSource[]);
    scan(options?: ScanOptions): Promise<AtlasIndex>;
    /** 读取当前索引(不存在返回 null) */
    loadIndex(): Promise<AtlasIndex | null>;
    /** 索引体检:条目数、构建时间、数据源状态、TTL、Top10 预览 */
    status(ttlHours: number): Promise<{
        exists: boolean;
        location: string;
        pluginCount?: undefined;
        builtAt?: undefined;
        stale?: undefined;
        sources?: undefined;
        top10?: undefined;
    } | {
        exists: boolean;
        location: string;
        pluginCount: number;
        builtAt: string;
        stale: boolean;
        sources: SourceHealth[];
        top10: {
            name: string;
            id: string;
            stars: number;
            quality: number;
            type: PluginType;
        }[];
    }>;
}
