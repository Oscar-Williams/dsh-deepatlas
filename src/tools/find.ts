/**
 * 工具:deepatlas_find(M3 被动推荐)
 * 检索本地索引做关键词预筛,返回候选与质量分;语义排序由 DSH 模型完成。
 */
import { Context } from '@deepseek-ai/cordis'
import { DeepAtlasConfig } from '../config.js'
import { Recommendation } from '../types.js'
import { scannerFor } from './scan.js'
import { looseObjectOutput, renderJson } from './common.js'
import { getRuntimeInfo } from '../core/compat.js'
import { retrieve } from '../core/retrieval.js'
import { CAPABILITY_PARAMETER_SCHEMA, CapabilityInput, normalizeCapabilityIds } from '../core/capabilities.js'

export function buildFindTool(_ctx: Context, config: DeepAtlasConfig) {
  return {
    name: 'deepatlas_find',
    description:
      '按自然语言任务需求在本地索引中检索插件,返回候选列表(含质量分、匹配提示、安装命令预览)。若索引缺失或过期会提示先扫描。语义相关性由模型基于返回的候选元数据判断。',
    parameters: {
      need: { type: 'string' as const, required: true, description: '任务需求原文' },
      limit: { type: 'number' as const, description: '返回候选上限,默认 8' },
      capabilities: CAPABILITY_PARAMETER_SCHEMA,
    },
    output: { schema: looseObjectOutput, render: renderJson },
    async execute(args: { need: string; limit?: number; capabilities?: CapabilityInput }) {
      const scanner = scannerFor(config)
      const status = await scanner.status(config.indexTtlHours)
      if (!status.exists) {
        return { ok: false, message: '本地索引不存在,请先调用 deepatlas_scan 重建索引' }
      }
      if (status.stale) {
        return { ok: false, message: '索引已过期,请先调用 deepatlas_scan 刷新' }
      }
      const index = await scanner.loadIndex()
      // Eligibility(⑦.0-d):死链/归档过滤 + 实体分类(框架/清单不可装)
      const plugins = (index?.plugins ?? []).filter(
        (p) => p.stars >= config.minStars && !p.deadLink && p.kind !== 'framework' && p.kind !== 'collection',
      )

      // 检索 v2:capability taxonomy + 多字段加权(与基准共用,单一事实源)
      const extraCaps = normalizeCapabilityIds(args.capabilities)
      const pool = retrieve(args.need, plugins, args.limit ?? 8, extraCaps)
      const candidates = pool.map(({ plugin: p, taskScore, capOverlap }) => {
        const [owner, repo] = p.id.split('/')
        const archivedNote = p.archived ? ';⚠️仓库已归档' : ''
        const rec: Recommendation = {
          plugin: p,
          reason: `任务匹配 ${taskScore}(能力:${capOverlap.join(', ') || '词汇命中'});质量分 ${p.quality?.total}(活跃 ${p.quality?.activity}/社区 ${p.quality?.community}/可信 ${p.quality?.trust})${archivedNote}`,
          overlap: undefined,
          overlapNote: capOverlap.length > 1 ? `命中 ${capOverlap.length} 项能力,可对比同类候选` : undefined,
          installCommandPreview: `dsh plugin --profile ${config.installProfile} add github:${owner}/${repo}#<commit>`,
        }
        return rec
      })

      const runtime = getRuntimeInfo()
      return {
        ok: true,
        need: args.need,
        runtime: {
          platform: `${runtime.platform}/${runtime.arch}`,
          node: runtime.nodeVersion,
          note: '逐插件兼容性结论(Node 引擎/native/构建脚本)需经 deepatlas_audit 获取;安装前必须审计',
        },
        candidates,
        hint: candidates.length === 0 ? '索引中无关键词命中,可由模型再判断是否语义相关,或建议用户去 GitHub topic 搜索' : undefined,
      }
    },
  }
}
