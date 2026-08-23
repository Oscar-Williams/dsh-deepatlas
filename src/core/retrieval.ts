/**
 * 检索 v2(⑦.2+⑦.3,采纳评审第八轮 §9-12)
 * 生产与基准共用的单一事实源。
 *
 * Eligibility(能否进池):!deadLink && !archived && kind 可安装
 * Retrieval(多字段召回):capability×5 + name×4 + description×3 + topics×2
 * Rerank(排序):taskScore 主导,quality 次级,star 仅经 quality*0.25 间接进入
 */
import { PluginMeta } from '../types.js'
import { classifyKind, isInstallable } from './kind.js'
import { extractCapabilities } from './capabilities.js'

export interface RetrievalCandidate {
  plugin: PluginMeta
  taskScore: number
  capOverlap: string[]
  lexScore: number
  nameBonus: number
}

export function tokenize(need: string): string[] {
  const raw = need.toLowerCase()
  return [...new Set(
    raw.split(/[^\p{Script=Han}\p{L}\p{N}]+/u)
      .flatMap((w) => (/\p{Script=Han}/u.test(w) ? (w.match(/.{1,2}/gu) ?? []) : [w]))
      .filter((t) => t.length >= 2),
  )]
}

export function eligible(p: PluginMeta): boolean {
  const kind = p.kind ?? classifyKind({ id: p.id, name: p.displayName ?? p.name, description: p.description, fork: p.fork })
  return !p.deadLink && !p.archived && isInstallable(kind)
}

/** 多字段检索:返回按 taskScore×10 + quality×2 排序的候选池 */
export function retrieve(task: string, plugins: PluginMeta[], poolSize = 30): RetrievalCandidate[] {
  const tokens = tokenize(task)
  const taskCaps = extractCapabilities(task)

  const scored: RetrievalCandidate[] = []
  for (const p of plugins) {
    if (!eligible(p)) continue
    const name = (p.displayName ?? p.name).toLowerCase()
    const desc = p.description.toLowerCase()
    const topics = p.topics.join(' ').toLowerCase()

    const pluginCaps = extractCapabilities(`${p.displayName ?? p.name} ${p.description} ${p.topics.join(' ')}`)
    const capOverlap = [...taskCaps].filter((c) => pluginCaps.has(c))

    // 字段加权 lexical:name 命中 ×4,description ×3,topics ×2
    let lexScore = 0
    let nameBonus = 0
    for (const t of tokens) {
      if (name.includes(t)) { lexScore += 4; nameBonus += 4 }
      if (desc.includes(t)) lexScore += 3
      if (topics.includes(t)) lexScore += 2
    }

    const taskScore = capOverlap.length * 5 + lexScore
    if (taskScore <= 0) continue
    scored.push({ plugin: p, taskScore, capOverlap, lexScore, nameBonus })
  }

  return scored
    .sort((a, b) => {
      const fa = a.taskScore * 10 + (a.plugin.quality?.total ?? 0) * 3
      const fb = b.taskScore * 10 + (b.plugin.quality?.total ?? 0) * 3
      return fb - fa
    })
    .slice(0, poolSize)
}
