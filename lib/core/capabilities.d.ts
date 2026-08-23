/**
 * Capability taxonomy v1(⑦.2,采纳评审第八轮 §10)
 * 20-40 个高价值能力类目,中英别名;从任务文本与插件元数据双向抽取。
 * 这是检索层的语义骨架:匹配不再依赖 README 恰好用了某个词。
 */
export interface CapabilityDef {
    id: string;
    aliases: string[];
}
export declare const CAPABILITIES: CapabilityDef[];
/** 从任意文本抽取能力:中文 alias 子串匹配;拉丁 alias 词边界匹配(防 word→keywords 误伤) */
export declare function extractCapabilities(text: string): Set<string>;
export interface CapEvidence {
    source: string;
    text: string;
}
export interface PluginCapRecord {
    id: string;
    confidence: number;
    ev: CapEvidence[];
}
/** v3-B 证据化抽取:按字段记录命中别名;confidence 1 证据 0.6 / 2+ 证据 0.9(确定性) */
export declare function extractCapabilityRecords(parts: {
    source: string;
    text: string;
}[]): PluginCapRecord[];
