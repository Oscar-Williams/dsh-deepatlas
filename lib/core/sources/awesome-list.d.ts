/**
 * 数据源:awesome 清单(白名单与目录兜底)
 *
 * 解析 awesome 仓库 README 中 `- [name](url) — desc` 形态的条目,
 * 作为 GitHub topic 的补充与降级来源;同时维护白名单命中标记。
 */
import { EcosystemSource, RawPluginEntry } from './types.js';
/** 生态公认的白名单仓库(命中即 whitelisted=true) */
export declare const WHITELIST_REPOS: string[];
/** 骨架阶段收录的清单源,P1 扩展为可配置 */
export declare const AWESOME_LISTS: {
    sourceId: string;
    url: string;
}[];
export declare class AwesomeListSource implements EcosystemSource {
    readonly id = "awesome-list";
    readonly label = "awesome \u6E05\u5355(\u767D\u540D\u5355/\u76EE\u5F55)";
    collect(): AsyncGenerator<RawPluginEntry, void, unknown>;
}
