/**
 * 工具:deepatlas_advise(P4.1 Capability-gap Advisor)
 *
 * 安静顾问原则(评审第六轮):已有能力足够 → silent;仅当任务命中
 * 索引强候选且未安装时,给出 1-3 条建议。已装清单来自宿主
 * dump-config 行(exec 注入可测)。
 */
import { Context } from '@deepseek-ai/cordis'
import { DeepAtlasConfig } from '../config.js'

import { scannerFor } from './scan.js'
import { looseObjectOutput, renderJson } from './common.js'
import { extractCapabilities } from '../core/capabilities.js'
import { retrieve } from '../core/retrieval.js'

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

      // P4.1 正式形态:按 capabilities 判缺口(非插件 ID,评审第八轮 §16)
      const taskCaps = extractCapabilities(args.task)
      if (taskCaps.size === 0) {
        return { silent: true, reason: '任务未识别出能力需求,不打扰' }
      }
      const dumpText = await dumpFn()
      // 已装能力 = 已装插件(含宿主自身)全部能力之并集
      const installedCaps = new Set<string>()
      for (const m of dumpText.matchAll(/name:\s*'?([@\w\/.:-]+)'?/g)) {
        for (const c of extractCapabilities(m[1])) installedCaps.add(c)
      }
      // dump 行文本里往往还有描述性词,直接对全文抽一次兜底
      for (const c of extractCapabilities(dumpText)) installedCaps.add(c)

      const missingCaps = [...taskCaps].filter((c) => !installedCaps.has(c))
      if (missingCaps.length === 0) {
        return { silent: true, reason: `所需能力已具备(${[...taskCaps].join(', ')}),保持安静` }
      }

      const pool = retrieve(args.task, index.plugins, 3)
      const recs = pool.filter(({ capOverlap }) => capOverlap.some((c) => missingCaps.includes(c)))
      if (recs.length === 0) {
        return { silent: true, reason: `缺能力(${missingCaps.join(', ')})但索引中无强匹配插件` }
      }
      return {
        silent: false,
        gap: `任务需要 ${missingCaps.join(', ')} 能力,当前宿主未覆盖`,
        recommendations: recs.map(({ plugin: p, taskScore, capOverlap }) => ({
          id: p.id,
          name: p.displayName ?? p.name,
          stars: p.stars,
          quality: p.quality?.total ?? 0,
          reason: `补齐 ${capOverlap.filter((c) => missingCaps.includes(c)).join(', ')};任务匹配 ${taskScore}`,
          installCommandPreview: `dsh plugin --profile ${config.installProfile} add github:${p.id}#<commit>`,
        })),
      }
    },
  }
}
