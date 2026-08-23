/**
 * 数据源:awesome 清单(白名单与目录兜底)
 *
 * 解析 awesome 仓库 README 中 `- [name](url) — desc` 形态的条目,
 * 作为 GitHub topic 的补充与降级来源;同时维护白名单命中标记。
 */
import { EcosystemSource, RawPluginEntry } from './types.js';
/** 生态公认的白名单仓库(命中即 whitelisted=true) */
export declare const WHITELIST_REPOS: string[];
/** 当前纳入扫描与健康检查的社区清单源。 */
export declare const AWESOME_LISTS: {
    sourceId: string;
    repo: string;
    ref: string;
    path: string;
}[];
export declare class AwesomeListSource implements EcosystemSource {
    readonly id = "awesome-list";
    readonly label = "awesome \u6E05\u5355(\u767D\u540D\u5355/\u76EE\u5F55)";
    collect(token?: string, signal?: AbortSignal): AsyncGenerator<RawPluginEntry, void, unknown>;
}
