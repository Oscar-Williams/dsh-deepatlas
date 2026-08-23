/**
 * 安全审计器(M4):安装的前置门槛
 *
 * 审计规则(借鉴 dsh-find-plugins 并扩展),当前版本基于 package.json
 * 清单快照;P3 扩展为抓取仓库源码树做静态扫描 + npm audit。
 * 输出结构化报告:风险分级(绿/黄/红)+ 逐条证据,红色一律拒绝自动安装。
 */
import { AuditReport } from '../types.js';
/** 审计输入:目标插件的清单快照与仓库信息 */
export interface AuditInput {
    /** "owner/repo" */
    target: string;
    /** 目标仓库的 package.json(解析后的对象;skill 型插件可能没有,传 null) */
    manifest: Record<string, unknown> | null;
    /** 是否锁定到具体 commit */
    commitPinned: boolean;
    /** 仓库是否在白名单 */
    whitelisted: boolean;
}
export declare function audit(input: AuditInput): AuditReport;
