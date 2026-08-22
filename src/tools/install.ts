/**
 * 工具:deepatlas_install(M5)
 * 授权安装闸门:显式同意 + 非 red 审计 + commit 锁定,三者缺一拒绝。
 * 骨架阶段 dryRun 默认开启,只生成命令不执行(P3 接通 dsh CLI)。
 */
import { Context } from '@deepseek-ai/cordis'
import { Schema } from '@deepseek-ai/schemastery'
import { DeepAtlasConfig } from '../config.js'
import { planInstall, executeInstall } from '../core/installer.js'
import { AuditLevel } from '../types.js'

export function buildInstallTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_install',
    description:
      '安装社区插件(需先通过 deepatlas_audit)。强制条件:用户显式同意、审计非红色、锁定具体 commit。dryRun 模式只返回安装命令。',
    parameters: Schema.object({
      target: Schema.string().required().description('目标仓库,格式 owner/repo'),
      commit: Schema.string().required().description('锁定的 commit 短哈希(供应链安全,必填)'),
      auditLevel: Schema.union(['green', 'yellow', 'red'] as const)
        .required()
        .description('最近一次 deepatlas_audit 的等级'),
      userConsent: Schema.boolean().required().description('用户是否明确同意安装,必须由用户亲口/显式操作给出'),
    }),
    async execute(args: { target: string; commit: string; auditLevel: AuditLevel; userConsent: boolean }) {
      const target = args.target.toLowerCase().replace(/^github:/, '')
      const plan = planInstall(
        {
          target,
          commit: args.commit,
          profile: config.installProfile,
          userConsent: args.userConsent,
          audit: {
            target,
            level: args.auditLevel,
            findings: [],
            scope: ['由调用方传入最近一次审计等级(骨架阶段简化链路,P3 改为自动串联审计结果)'],
            commitPinned: Boolean(args.commit),
            auditedAt: new Date().toISOString(),
          },
        },
        config.dryRun,
      )
      if (!plan.allowed) {
        return { ok: false, blockedReason: plan.blockedReason, command: plan.command }
      }
      const output = await executeInstall(plan)
      return {
        ok: true,
        dryRun: plan.dryRun,
        command: plan.command,
        output,
        restartHint: plan.restartHint,
      }
    },
  }
}
