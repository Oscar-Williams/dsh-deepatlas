/**
 * 工具:deepatlas_advise(P4.1 Capability-gap Advisor)
 *
 * 安静顾问原则(评审第六轮):已有能力足够 → silent;仅当任务命中
 * 索引强候选且未安装时,给出 1-3 条建议。已装清单来自宿主
 * dump-config 行(exec 注入可测)。
 */
import { Context } from '@deepseek-ai/cordis'
import { DeepAtlasConfig } from '../config.js'
import { PluginMeta } from '../types.js'
import { scannerFor } from './scan.js'
import { looseObjectOutput, renderJson } from './common.js'

export type DumpRunner = () => Promise<string>

export const defaultDumpRunner: DumpRunner = async () => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  const exec = promisify(execFile)
  try {
    const { stdout } = await exec('dsh', ['--profile', 'web', '--dump-config'], { timeout: 30_000 })
    return stdout
  } catch {
    return ''
  }
}

function prescore(meta: PluginMeta, tokens: string[]): number {
  const haystack = `${meta.name} ${meta.description} ${meta.topics.join(' ')}`.toLowerCase()
  return tokens.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0)
}

function tokenize(need: string): string[] {
  const raw = need.toLowerCase()
  return [...new Set(
    raw
      .split(/[^\p{Script=Han}\p{L}\p{N}]+/u)
      .flatMap((w) => (/\p{Script=Han}/u.test(w) ? (w.match(/.{1,2}/gu) ?? []) : [w]))
      .filter((t) => t.length >= 2),
  )]
}

export function buildAdviseTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_advise',
    description:
      '能力缺口顾问:给定用户任务,若当前 Harness 已有相关插件则保持安静(silent),仅当发现未安装的强匹配插件时给出 1-3 条建议(含质量分与安装预览)。P4.1。',
    parameters: {
      task: { type: 'string' as const, required: true, description: '用户当前任务描述,如"帮我控制 Home Assistant"' },
    },
    output: { schema: looseObjectOutput, render: renderJson },
    async execute(args: { task: string }, dumpFn: DumpRunner = defaultDumpRunner) {
      const scanner = scannerFor(config)
      const index = await scanner.loadIndex()
      if (!index) return { silent: true, reason: '索引不存在' }

      const tokens = tokenize(args.task)
      const dumpText = await dumpFn()
      const installed = new Set(
        [...dumpText.matchAll(/name:\s*'?([@\w/.-]+)'?/g)].map((m) => m[1].toLowerCase().split('/').pop() ?? ''),
      )

      const candidates = index.plugins
        .filter((p) => !p.deadLink && !p.archived)
        .map((p) => ({ p, s: prescore(p, tokens) }))
        .filter(({ s }) => s >= 2) // 强候选门槛:至少 2 个词命中
        .sort((a, b) => b.s - a.s || (b.p.quality?.total ?? 0) - (a.p.quality?.total ?? 0))
        .slice(0, 3)

      if (candidates.length === 0) {
        return { silent: true, reason: '索引中无明显匹配能力,不打扰' }
      }
      const missing = candidates.filter(({ p }) => !installed.has(p.name.toLowerCase().split('/').pop() ?? ''))
      if (missing.length === 0) {
        return { silent: true, reason: `相关能力已安装(${candidates.map(({ p }) => p.name).join(', ')}),保持安静` }
      }
      return {
        silent: false,
        gap: `当前任务可能缺少能力支撑,建议评估 ${missing.length} 个插件`,
        recommendations: missing.map(({ p }) => ({
          id: p.id,
          name: p.name,
          stars: p.stars,
          quality: p.quality?.total ?? 0,
          reason: `命中 ${prescore(p, tokens)} 个任务关键词;${p.description.slice(0, 60)}`,
          installCommandPreview: `dsh plugin --profile ${config.installProfile} add github:${p.id}#<commit>`,
        })),
      }
    },
  }
}
