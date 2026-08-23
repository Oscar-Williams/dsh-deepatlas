/**
 * 检索 v2(⑦.2+⑦.3,采纳评审第八轮 §9-12)
 * 生产与基准共用的单一事实源。
 *
 * Eligibility(能否进池):!deadLink && !archived && kind 可安装
 * Retrieval(多字段召回):capability×5 + name×4 + description×3 + topics×2
 * Rerank(排序):taskScore 主导,quality 次级,star 仅经 quality*0.25 间接进入
 */
import { PluginMeta } from '../types.js';
export interface RetrievalCandidate {
    plugin: PluginMeta;
    taskScore: number;
    capOverlap: string[];
    lexScore: number;
    nameBonus: number;
}
export declare function tokenize(need: string): string[];
export declare function eligible(p: PluginMeta): boolean;
/** 多字段检索:返回按 taskScore×10 + quality×2 排序的候选池 */
export declare function retrieve(task: string, plugins: PluginMeta[], poolSize?: number): RetrievalCandidate[];
