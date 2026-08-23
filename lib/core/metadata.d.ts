/**
 * 元数据回填(P2/A2):为缺 star/时间的索引条目补抓 GitHub 事实
 *
 * 采纳评审意见的缓存与限流策略:
 * - 每条目记录 metadataFetchedAt;<7d 不重抓;
 * - 顺序抓取 + 350ms 节流;尊重 Retry-After;
 * - core 配额剩余 < RATE_FLOOR 立即收手并说明原因;
 * - 失败条目静默保留原值,下次再试。
 */
import { PluginMeta } from '../types.js';
import { IndexStore } from './index-store.js';
export interface RepoMetadata {
    stars: number;
    pushedAt: string;
    license: string;
    archived: boolean;
    fork: boolean;
    defaultBranch: string;
}
export type RepoFetcher = (id: string, token?: string) => Promise<{
    ok: true;
    data: RepoMetadata;
    remaining?: number;
} | {
    ok: false;
    missing?: boolean;
    retryAfterMs?: number;
    remaining?: number;
}>;
/** 真实实现:GET /repos/{owner}/{repo}(404 视为死链,403/429 视为限流) */
export declare const githubRepoFetcher: RepoFetcher;
/** 回填判定:缺 star/时间,或元数据已超 7 天未刷新 */
export declare function needsBackfill(meta: PluginMeta, now?: number): boolean;
export interface BackfillResult {
    updated: number;
    dead: number;
    skipped: number;
    stoppedReason?: 'rate-floor' | 'retry-after' | 'limit-reached';
}
export declare function backfillMetadata(store: IndexStore, options?: {
    token?: string;
    limit?: number;
    fetcher?: RepoFetcher;
    onProgress?: (done: number, total: number) => void;
}): Promise<BackfillResult>;
