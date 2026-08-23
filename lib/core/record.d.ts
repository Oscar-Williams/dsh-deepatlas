/**
 * PluginRecord 知识模型(P2):把"仓库条目"升级为"能力与要求图谱"
 *
 * DeepAtlas 的护城河不是搜索,而是归一化后的插件知识:功能、运行要求、
 * 信任与风险。record 由 package.json 清单(+索引元数据)构建,
 * 兼容性结论由 compat.checkCompatibility 给出。
 */
import { CompatibilityRequirement } from './compat.js';
export interface PluginRecord {
    /** owner/repo */
    id: string;
    name: string;
    version: string;
    description: string;
    /** 插件类型(bundle/cordis/skill),来自索引或清单推断 */
    type: 'bundle' | 'cordis' | 'skill' | 'unknown';
    /** 是否声明 dsh.bundle(bundle 角色) */
    declaresBundle: boolean;
    license: string;
    enginesNode?: string;
    nativeDependencies: string[];
    buildScripts: string[];
    /** 依赖总数(粗粒度供应链面) */
    dependencyCount: number;
    /** 元数据来源说明 */
    evidence: string[];
}
export declare function buildPluginRecord(id: string, manifest: Record<string, unknown> | null, meta?: {
    name?: string;
    type?: string;
    description?: string;
    license?: string;
}): PluginRecord;
/** 转为兼容性检查输入 */
export declare function toRequirement(record: PluginRecord): CompatibilityRequirement;
