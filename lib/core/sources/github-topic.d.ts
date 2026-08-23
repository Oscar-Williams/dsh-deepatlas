/**
 * 数据源:GitHub topic `dsh-plugin`(生态事实上的发现入口)
 *
 * P1 能力:
 * - 全量分页:遍历 search API 所有页(约 7800+ 仓库),页空或达 total 即止;
 * - 增量模式:仅抓 pushed:>since 之后有更新的仓库;
 * - 速率限制:403/429 读取 Retry-After 指数退避,有限重试后抛错由上层降级;
 * - 进度回调:onProgress({ page, fetched, total }) 供 CLI 实时输出。
 */
import { EcosystemSource, RawPluginEntry } from './types.js';
export interface TopicProgress {
    page: number;
    fetched: number;
    total: number;
}
export interface TopicCollectOptions {
    token?: string;
    /** 增量:仅抓该时间(ISO 8601)之后有推送的仓库 */
    since?: string;
    onProgress?: (p: TopicProgress) => void;
}
export declare class GitHubTopicSource implements EcosystemSource {
    private readonly options;
    readonly id = "github-topic";
    readonly label = "GitHub topic: dsh-plugin";
    constructor(options?: TopicCollectOptions);
    collect(): AsyncGenerator<RawPluginEntry, void, unknown>;
}
