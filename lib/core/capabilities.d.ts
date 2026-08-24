/**
 * Capability taxonomy v1(⑦.2,采纳评审第八轮 §10)
 * 20-40 个高价值能力类目,中英别名;从任务文本与插件元数据双向抽取。
 * 这是检索层的语义骨架:匹配不再依赖 README 恰好用了某个词。
 */
export interface CapabilityDef {
    id: string;
    aliases: string[];
}
import type { CapabilityClaim, EvidenceAtom, EvidenceProvenance, PluginEvidence, PluginMeta, PluginObservation } from '../types.js';
export declare const TAXONOMY_VERSION = "capability-taxonomy-v1";
export declare const EVIDENCE_EXTRACTOR_VERSION = "capability-evidence-v2.0.0";
export declare const EVIDENCE_RULE_VERSION = "capability-claims-v2.0.0";
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
export interface CapabilityTextPart {
    source: 'name' | 'description' | 'topics' | 'provides' | 'manifest-capability' | 'package-keyword' | 'readme' | 'legacy';
    text: string;
    provenance?: EvidenceProvenance;
    /** 结构化来源可直接声明规范 capability，跳过别名猜测。 */
    capabilityId?: string;
    polarity?: EvidenceAtom['polarity'];
    supersedesEvidenceIds?: string[];
}
/**
 * Evidence v2：事实 atom 与派生 claim 分离。同一 authority 内只采用最强信号，
 * 只有独立 authority 的佐证才增加最多 0.10，避免同一发布者堆叠关键词抬分。
 */
export declare function extractCapabilityEvidence(parts: CapabilityTextPart[], state?: PluginEvidence['state']): PluginEvidence;
export declare function computeCapabilityClaims(atoms: EvidenceAtom[], state: PluginEvidence['state']): CapabilityClaim[];
export declare function evidenceFromObservations(observations: PluginObservation[], state?: PluginEvidence['state']): PluginEvidence;
/** 业务层统一解析；v2 空 claims 保持为空，不回退文本猜测。 */
export declare function resolveCapabilityClaims(plugin: PluginMeta): CapabilityClaim[];
/** 兼容旧测试/调用点；返回完整 Evidence v2 的 capability claims。 */
export declare function extractCapabilityRecords(parts: CapabilityTextPart[]): CapabilityClaim[];
