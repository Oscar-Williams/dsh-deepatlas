/**
 * 工具:deepatlas_audit(M4)
 * 抓取目标仓库 package.json 快照,执行装前安全审计,返回分级报告。
 */
import { Context } from '@deepseek-ai/cordis'
import { Schema } from '@deepseek-ai/schemastery'
import { DeepAtlasConfig } from '../config.js'
import { audit } from '../core/auditor.js'
import { WHITELIST_REPOS } from '../core/sources/awesome-list.js'

const RAW = 'https://raw.githubusercontent.com'

async function fetchManifest(target: string, commit?: string): Promise<Record<string, unknown> | null> {
  const ref = commit ?? 'HEAD'
  const url = `${RAW}/${target}/${ref}/package.json`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    return (await res.json()) as Record<string, unknown>
  } catch {
    return null
  }
}

export function buildAuditTool(_ctx: Context, _config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_audit',
    description:
      '对目标插件执行装前安全审计(生命周期脚本/依赖形态/协议/commit 锁定/白名单),返回绿黄红分级与逐条证据。安装前必须执行。',
    parameters: Schema.object({
      target: Schema.string().required().description('目标仓库,格式 owner/repo'),
      commit: Schema.string().description('锁定的 commit 短哈希;不传则视为未锁定'),
    }),
    async execute(args: { target: string; commit?: string }) {
      const target = args.target.toLowerCase().replace(/^github:/, '')
      const manifest = await fetchManifest(target, args.commit)
      const report = audit({
        target,
        manifest,
        commitPinned: Boolean(args.commit),
        whitelisted: WHITELIST_REPOS.includes(target),
      })
      if (report.level === 'red') {
        return { ...report, action: '红色风险:拒绝自动安装,请人工审查源码后手动处理' }
      }
      return {
        ...report,
        action:
          report.level === 'yellow'
            ? '黄色风险:可在用户二次确认后继续安装流程'
            : '绿色:可进入用户确认与安装流程',
      }
    },
  }
}
