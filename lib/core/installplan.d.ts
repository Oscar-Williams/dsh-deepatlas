/**
 * InstallPlan 状态机(P3,采纳外部评审 #2889 教训)
 *
 * RESOLVED(目标与 commit 已确定,兼容性已核)
 *   → APPROVED(审计非红 + 用户显式同意)→ PLANNED(dry-run 仅生成命令)
 *   → INSTALLED(dsh plugin add 执行成功)
 *   → COMPOSED(dump-config 组合树含目标行,防 duplicate loader entry)
 *   → BOOT_VERIFIED(宿主重启冒烟通过,由外部分发 E2E 推进)
 *   → ACTIVE
 * 只有 ACTIVE 才向用户报告"安装成功"。
 */
import { PluginMeta, AuditReport } from '../types.js';
export type PlanState = 'RESOLVED' | 'APPROVED' | 'PLANNED' | 'INSTALLED' | 'COMPOSED' | 'BOOT_VERIFIED' | 'ACTIVE' | 'FAILED' | 'ROLLING_BACK' | 'ROLLED_BACK' | 'ROLLBACK_FAILED';
export type PlanBlocked = 'REJECTED_CONSENT' | 'REJECTED_AUDIT' | 'REJECTED_UNPINNED' | 'REJECTED_DUPLICATE' | 'REJECTED_COMPAT';
export interface InstallPlan {
    target: string;
    commit?: string;
    profile: string;
    state: PlanState | PlanBlocked;
    /** 触发 blocking 的证据说明 */
    detail?: string;
    /** 每次状态推进的时间线 */
    trace: {
        at: string;
        from: PlanState | PlanBlocked;
        to: PlanState | PlanBlocked;
        note?: string;
    }[];
    installCommand?: string;
}
export declare function newPlan(target: string, profile: string, commit?: string): InstallPlan;
export interface PlanGateInput {
    userConsent: boolean;
    audit: Pick<AuditReport, 'level'> | null;
    compatibilityOk: boolean;
}
/** RESOLVED → APPROVED:三重闸门 + 兼容性(P2 新增硬闸) */
export declare function approve(plan: InstallPlan, input: PlanGateInput): InstallPlan;
/** 装前查重(#2889):dump-config 输出已含目标插件行则拒绝 */
export declare function checkDuplicate(plan: InstallPlan, dumpConfigOutput: string, pluginName: string): InstallPlan;
/** APPROVED → INSTALLED:执行安装命令(exec 注入以便测试) */
export declare function install(plan: InstallPlan, dryRun: boolean, exec?: (cmd: string) => Promise<{
    code: number;
    output: string;
}>): Promise<InstallPlan>;
/** INSTALLED → COMPOSED:dump-config 断言目标行存在 */
export declare function verifyComposed(plan: InstallPlan, dumpConfigOutput: string, pluginName: string): InstallPlan;
/** COMPOSED → ACTIVE:宿主重启后的外部冒烟确认 */
export declare function markActiveIfBooted(plan: InstallPlan, booted: boolean): InstallPlan;
/** 任意执行中状态 → FAILED(验证失败进入故障分支,等待回滚) */
export declare function markFailed(plan: InstallPlan, stage: string, reason: string): InstallPlan;
/** FAILED → ROLLING_BACK → ROLLED_BACK；恢复动作失败必须显式暴露。 */
export declare function rollbackToSnapshot(plan: InstallPlan, restore: () => Promise<unknown>): Promise<InstallPlan>;
/** 用户层最终表述:只有 ACTIVE(成功)与 ROLLED_BACK(失败但已恢复)两种结语 */
export declare function finalVerdict(plan: InstallPlan): 'ACTIVE' | 'ROLLED_BACK' | 'ROLLBACK_FAILED' | 'BLOCKED' | 'IN_PROGRESS';
/** 是否可向用户宣告"安装成功" */
export declare function isActive(plan: InstallPlan): boolean;
/** 兼容元数据查找辅助(从索引条目取名) */
export declare function pluginNameOf(meta: PluginMeta): string;
