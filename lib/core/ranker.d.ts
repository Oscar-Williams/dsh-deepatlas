/**
 * 质量评分器(M2):静态分 85(活跃 35 + 社区 25 + 可信 25)+ 匹配预留 15
 * 纯函数实现,便于单元测试;评分只依赖 PluginMeta 静态字段。
 */
import { PluginMeta, QualityScore } from '../types.js';
/** 最近提交距今天数 → 活跃度分(0-100):7 天内满分,180 天以上归零 */
export declare function activityScore(lastPushedAt: string, now?: Date): number;
/**
 * star 对数缩放 → 社区分(0-100)。
 * 参考基数 15 万(头部生态位):0 星 0 分;千星级 ~58;万星级 ~78;
 * 官方 harness 183k⭐ ~100。修复旧版(基数 1000)头部全部饱和同分的缺陷。
 */
export declare function communityScore(stars: number): number;
/** 可信度分(0-100):白名单 +50,宽松开源协议 +30,规范命名(dsh- 前缀)+20,归档 -20 */
export declare function trustScore(meta: Pick<PluginMeta, 'whitelisted' | 'license' | 'name' | 'archived'>): number;
/** 综合静态分(match 恒为 0,推荐阶段由模型语义匹配后补足) */
export declare function rank(meta: PluginMeta): QualityScore;
