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
import { asLosslessJson, looseObjectOutput, renderJson, type ToolExecutionContext } from './common.js'
import {
  CAPABILITY_PARAMETER_SCHEMA,
  CapabilityInput,
  extractCapabilities,
  normalizeCapabilityIds,
} from '../core/capabilities.js'
import { retrieve } from '../core/retrieval.js'
import { dshInvocation, isDshProfileName } from '../core/dsh-cli.js'

export type DumpRunner = (signal?: AbortSignal) => Promise<string>

/** 宿主已装清单读取器(闭包绑定 profile,v0.1.1 修复硬编码 web 的不一致) */
export function makeDumpRunner(profile: string): DumpRunner {
  return async (signal) => {
    if (!isDshProfileName(profile)) return ''
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const exec = promisify(execFile)
    try {
      const invocation = dshInvocation(['--profile', profile, '--dump-config'])
      const { stdout } = await exec(invocation.command, invocation.args, { timeout: 30_000, signal })
      return stdout
    } catch (error) {
      if (signal?.aborted) throw error
      return ''
    }
  }
}

export function buildAdviseTool(
  _ctx: Context,
  config: DeepAtlasConfig,
  dumpFn: DumpRunner = makeDumpRunner(config.installProfile),
) {
  return {
    name: 'deepatlas_advise',
    description:
      '能力缺口顾问:给定用户任务,若当前 Harness 已有相关插件则保持安静(silent),仅当发现未安装的强匹配插件时给出 1-3 条建议(含质量分与安装预览)。P4.1。',
    parameters: {
      task: { type: 'string' as const, required: true, description: '用户当前任务描述原文' },
      capabilities: CAPABILITY_PARAMETER_SCHEMA,
    },
    output: { schema: looseObjectOutput, render: renderJson },
    async execute(args: { task: string; capabilities?: CapabilityInput }, execution?: ToolExecutionContext) {
      const scanner = scannerFor(config)
      const index = await scanner.loadIndex()
      if (!index) return asLosslessJson({ silent: true, reason: '索引不存在' })

      // P4.1 正式形态:按 capabilities 判缺口(非插件 ID,评审第八轮 §16)
      // v3-A 混合归一:静态抽取 ∪ 模型传入 caps(与 find 同通道)
      const taskCaps = new Set<string>([
        ...extractCapabilities(args.task),
        ...normalizeCapabilityIds(args.capabilities),
      ])
      if (taskCaps.size === 0) {
        return asLosslessJson({ silent: true, reason: '任务未识别出能力需求,不打扰' })
      }
      const dumpText = await dumpFn(execution?.signal)
      // v3-B 精确路径:已装 ID → 索引 capsEv join;未入索引的回退到 ID 文本抽取
      const installedCaps = new Set<string>()
      for (const m of dumpText.matchAll(/name:\s*'?([@\w\/.:-]+)'?/g)) {
        const rec = index.plugins.find(
          (p) => p.id === m[1].toLowerCase() || (p.displayName ?? p.name).toLowerCase() === m[1].toLowerCase(),
        )
        if (rec?.capsEv?.length) rec.capsEv.forEach((c) => installedCaps.add(c.id))
        else for (const c of extractCapabilities(m[1])) installedCaps.add(c)
      }
      // v0.1.1 保守化:不再对 dump 全文跑 alias(配置文本出现某词≠具备该能力);
      // 精确路径(Installed IDs → PluginRecord.capabilities)在 Retrieval v3-B 实现。

      const missingCaps = [...taskCaps].filter((c) => !installedCaps.has(c))
      if (missingCaps.length === 0) {
        return asLosslessJson({ silent: true, reason: `所需能力已具备(${[...taskCaps].join(', ')}),保持安静` })
      }

      const pool = retrieve(args.task, index.plugins, 3, [...taskCaps])
      const recs = pool.filter(({ capOverlap }) => capOverlap.some((c) => missingCaps.includes(c)))
      if (recs.length === 0) {
        return asLosslessJson({ silent: true, reason: `缺能力(${missingCaps.join(', ')})但索引中无强匹配插件` })
      }
      return asLosslessJson({
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
      })
    },
  }
}
