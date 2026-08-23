/**
 * 授权安装器(M5):推荐 → 审计 → 用户显式同意 → 安装(锁定 commit)
 *
 * 安全红线(任务书):
 * 1. 没有 userConsent=true 绝不安装;
 * 2. 审计为 red 的一律拒绝,只能提示用户手动处理;
 * 3. 默认锁定 commit,防供应链投毒;
 * 4. dryRun 默认开启,只生成命令不执行。
 */
import { AuditReport } from '../types.js';
export interface InstallRequest {
    /** "owner/repo" */
    target: string;
    /** 锁定的 commit(短哈希);空表示未锁定 */
    commit?: string;
    /** dsh profile 名 */
    profile: string;
    /** 审计报告(必须已执行) */
    audit: AuditReport;
    /** 用户显式同意 */
    userConsent: boolean;
}
export interface InstallPlan {
    allowed: boolean;
    blockedReason?: string;
    command: string;
    dryRun: boolean;
    restartHint: string;
}
/** 生成安装命令(对齐生态惯例:dsh plugin --profile X add github:owner/repo#ref) */
export declare function buildCommand(req: InstallRequest): string;
/** 闸门检查:同意与风险等级都满足才放行 */
export declare function planInstall(req: InstallRequest, dryRun: boolean): InstallPlan;
/**
 * 执行安装。dryRun=true 时仅返回命令文本;
 * P3 实现真实执行(execFile 调 dsh CLI)并捕获输出与退出码。
 */
export declare function executeInstall(plan: InstallPlan, _exec?: (cmd: string) => Promise<string>): Promise<string>;
