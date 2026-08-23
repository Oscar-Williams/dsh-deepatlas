/**
 * 工具:deepatlas_install(M5/P3)
 * 接入 InstallPlan 状态机:approve(四重闸门)→ checkDuplicate(装前查重)
 * → install(真实/dry-run)→ verifyComposed(dump-config 断言)。
 * BOOT_VERIFIED/ACTIVE 由外部冒烟脚本推进(工具进程内不宜再起宿主)。
 */
import { Context } from '@deepseek-ai/cordis'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { DeepAtlasConfig } from '../config.js'
import { AuditLevel } from '../types.js'
import { looseObjectOutput, renderJson } from './common.js'
import { newPlan, approve, checkDuplicate, install, verifyComposed, InstallPlan } from '../core/installplan.js'
import { buildPluginRecord, toRequirement } from '../core/record.js'
import { checkCompatibility, getRuntimeInfo } from '../core/compat.js'

const exec = promisify(execFile)

async function run(cmd: string, args: string[]): Promise<{ code: number; output: string }> {
  try {
    const { stdout } = await exec(cmd, args, { timeout: 120_000 })
    return { code: 0, output: stdout }
  } catch (err) {
    const e = err as { code?: number; stdout?: string; message: string }
    return { code: e.code ?? 1, output: (e.stdout ?? '') + e.message }
  }
}

export function buildInstallTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_install',
    description:
      '安装社区插件(需先 deepatlas_audit)。四重闸门(同意/非红审计/锁 commit/兼容)+装前查重(防 #2889),全程状态机 trace 可审计,仅 ACTIVE 视为成功。dryRun 模式只生成命令。',
    parameters: {
      target: { type: 'string' as const, required: true, description: '目标仓库,格式 owner/repo' },
      commit: { type: 'string' as const, required: true, description: '锁定的 commit 短哈希(供应链安全,必填)' },
      auditLevel: { type: 'string' as const, required: true, description: '最近一次 deepatlas_audit 的等级:green/yellow/red' },
      userConsent: { type: 'boolean' as const, required: true, description: '用户是否明确同意安装,必须由用户亲口/显式操作给出' },
      enginesNode: { type: 'string' as const, description: '目标包 engines.node(缺省按 unknown 评估)' },
    },
    output: { schema: looseObjectOutput, render: renderJson },
    async execute(args: {
      target: string
      commit: string
      auditLevel: AuditLevel
      userConsent: boolean
      enginesNode?: string
    }): Promise<{ ok: boolean; plan: InstallPlan }> {
      const target = args.target.toLowerCase().replace(/^github:/, '')
      const record = buildPluginRecord(target, {
        name: target.split('/')[1], version: '0', description: '', type: 'unknown',
        license: 'unknown', engines: args.enginesNode ? { node: args.enginesNode } : {},
        scripts: {}, dependencies: {},
      } as unknown as Record<string, unknown>)
      const compat = checkCompatibility(toRequirement(record), getRuntimeInfo())

      let plan = newPlan(target, config.installProfile, args.commit)
      plan = approve(plan, {
        userConsent: args.userConsent,
        audit: { level: args.auditLevel },
        compatibilityOk: compat.ok,
      })
      if (plan.state === 'APPROVED' && !config.dryRun) {
        // 装前查重:读当前 profile 组合树(#2889)
        const dump = await run('dsh', ['--profile', config.installProfile, '--dump-config'])
        plan = checkDuplicate(plan, dump.output, target.split('/')[1])
      }
      if (plan.state === 'APPROVED') {
        plan = await install(plan, config.dryRun, async (cmd) => {
          const [c, ...rest] = cmd.split(' ')
          return run(c, rest)
        })
      }
      if (plan.state === 'INSTALLED' && !config.dryRun) {
        const dump = await run('dsh', ['--profile', config.installProfile, '--dump-config'])
        plan = verifyComposed(plan, dump.output, target.split('/')[1])
      }
      const ok = plan.state === 'COMPOSED' || plan.state === 'ACTIVE'
      return { ok, plan }
    },
  }
}
