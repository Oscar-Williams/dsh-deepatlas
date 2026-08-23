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
/** 模型可传入的规范能力 ID。工具 schema 与运行时校验共用这一事实源。 */
export declare const CAPABILITY_IDS: string[];
/** deepatlas_find 与 deepatlas_advise 共用的模型输入契约。 */
export declare const CAPABILITY_PARAMETER_SCHEMA: {
    type: "array";
    items: {
        type: "string";
        enum: string[];
    };
    description: string;
};
export type CapabilityInput = string[] | string | undefined;
/**
 * 规范化模型传入的能力 ID。数组是公开工具契约；字符串仅用于兼容旧的直接调用。
 * 未知 ID 会被忽略，避免绕过 schema 的调用污染检索条件。
 */
export declare function normalizeCapabilityIds(input: CapabilityInput): string[];
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
