/**
 * 生态扫描器(M1/P1):编排各数据源 → 去重合并 → 白名单标记 → 评分 → 落盘
 *
 * P1 新增:
 * - 增量模式(incremental):基于上次 builtAt 只抓更新,与旧索引合并;
 * - 类型精判(enrichTopN):对 star 靠前的仓库读文件清单判定类型;
 * - 进度回调(onProgress)透传到 CLI。
 * 降级链:github-topic 失败 → awesome-list 兜底;全部失败 → 保留旧索引。
 */
import { AtlasIndex, PluginMeta, PluginType, SourceHealth } from '../types.js'
import { rank } from './ranker.js'
import { EcosystemSource, RawPluginEntry } from './sources/types.js'
import { GitHubTopicSource } from './sources/github-topic.js'
import { AwesomeListSource, WHITELIST_REPOS } from './sources/awesome-list.js'
import { enrichTopN } from './sources/enrich.js'
import { IndexStore, SCHEMA_VERSION } from './index-store.js'

/** 按仓库自述关键词的粗粒度类型推断(精判兜底,证据弱于 contents API) */
function inferType(entry: RawPluginEntry): PluginType {
  const text = `${entry.name} ${entry.description}`.toLowerCase()
  if (/\bskill\b|技能/.test(text)) return 'skill'
  if (/\bbundle\b|全家桶|发行版/.test(text)) return 'bundle'
  if (/cordis|插件|plugin/.test(text)) return 'cordis'
  return 'unknown'
}

function toMeta(entry: RawPluginEntry, sourceId: string): PluginMeta {
  return {
    id: entry.id,
    name: entry.name,
    repoUrl: entry.repoUrl,
    description: entry.description,
    type: inferType(entry),
    typeSource: 'heuristic',
    stars: entry.stars,
    lastPushedAt: entry.lastPushedAt,
    license: entry.license,
    topics: entry.topics,
    whitelisted: WHITELIST_REPOS.includes(entry.id),
    provides: entry.provides ?? [],
    source: sourceId,
    fetchedAt: new Date().toISOString(),
  }
}

export interface ScanProgress {
  sourceId: string
  message: string
}

export interface ScanOptions {
  token?: string
  /** 增量模式:基于上次索引 builtAt 合并;无旧索引时自动退化为全量 */
  incremental?: boolean
  /** 类型精判的仓库数上限(按 star 排序取头部),0 = 跳过精判 */
  enrichTopN?: number
  /** 仅供测试注入:替换默认数据源 */
  sources?: EcosystemSource[]
  onProgress?: (p: ScanProgress) => void
}

/** 合并策略:新条目字段优先,空值回落旧值;白名单命中保留 */
function mergeMeta(existing: PluginMeta, incoming: PluginMeta): PluginMeta {
  return {
    ...existing,
    name: incoming.name || existing.name,
    description: incoming.description || existing.description,
    type: incoming.type !== 'unknown' ? incoming.type : existing.type,
    typeSource: incoming.typeSource === 'contents' ? 'contents' : existing.typeSource,
    stars: incoming.stars || existing.stars,
    lastPushedAt: incoming.lastPushedAt || existing.lastPushedAt,
    license: incoming.license !== 'unknown' && incoming.license !== 'none' ? incoming.license : existing.license,
    topics: incoming.topics.length ? incoming.topics : existing.topics,
    whitelisted: existing.whitelisted || incoming.whitelisted,
    provides: incoming.provides.length ? incoming.provides : existing.provides,
    source: incoming.source || existing.source,
    fetchedAt: incoming.fetchedAt,
  }
}

export class Scanner {
  constructor(
    private readonly store: IndexStore,
    private readonly sources: EcosystemSource[] = [new GitHubTopicSource(), new AwesomeListSource()],
  ) {}

  async scan(options: ScanOptions = {}): Promise<AtlasIndex> {
    const previous = await this.store.load()
    const incremental = Boolean(options.incremental && previous)
    const since = incremental ? previous!.builtAt : undefined
    const sources = incremental
      ? this.sources.map((s) => (s instanceof GitHubTopicSource ? new GitHubTopicSource({ token: options.token, since }) : s))
      : this.sources.map((s) => (s instanceof GitHubTopicSource ? new GitHubTopicSource({ token: options.token }) : s))

    const healths: SourceHealth[] = []
    // 以仓库 id 为键去重;GitHub topic 数据优先(star/时间更准),awesome 补白名单
    const merged = new Map<string, PluginMeta>()
    if (incremental && previous) {
      for (const p of previous.plugins) merged.set(p.id, p)
    }

    // 增量模式有旧索引兜底,0 新条目也可落盘;全量模式必须抓到 ≥1 条
    let anyOk = incremental
    for (const source of sources) {
      const health: SourceHealth = {
        sourceId: source.id,
        ok: true,
        itemCount: 0,
        fetchedAt: new Date().toISOString(),
        mode: incremental ? 'incremental' : 'full',
      }
      try {
        for await (const entry of source.collect(options.token)) {
          health.itemCount++
          const incoming = toMeta(entry, source.id)
          const existing = merged.get(entry.id)
          merged.set(entry.id, existing ? mergeMeta(existing, incoming) : incoming)
        }
        if (health.itemCount > 0) anyOk = true
      } catch (err) {
        health.ok = false
        health.error = err instanceof Error ? err.message : String(err)
        options.onProgress?.({ sourceId: source.id, message: `源 ${source.id} 失败:${health.error}(降级继续)` })
      }
      healths.push(health)
    }
    if (!anyOk) throw new Error('全部数据源失败且无旧索引可用,保留原索引不落盘')

    // 类型精判:对 star 头部仓库读文件清单(网络操作,失败静默保留启发式)
    const enrichN = options.enrichTopN ?? (incremental ? 0 : 30)
    if (enrichN > 0) {
      const targets = [...merged.values()]
        .sort((a, b) => b.stars - a.stars)
        .slice(0, enrichN)
        .map((m) => m.id)
      options.onProgress?.({ sourceId: 'enrich', message: `类型精判 ${targets.length} 个仓库…` })
      const enriched = await enrichTopN(targets, options.token, (done) => {
        if (done % 10 === 0) options.onProgress?.({ sourceId: 'enrich', message: `类型精判 ${done}/${targets.length}` })
      })
      for (const [id, r] of enriched) {
        const meta = merged.get(id)
        if (!meta) continue
        merged.set(id, {
          ...meta,
          type: r.type === 'unknown' ? meta.type : r.type,
          typeSource: r.type === 'unknown' ? 'heuristic' : 'contents',
        })
      }
    }

    const plugins = [...merged.values()].map((meta) => ({ ...meta, quality: rank(meta) }))
    plugins.sort((a, b) => (b.quality?.total ?? 0) - (a.quality?.total ?? 0))

    const index: AtlasIndex = {
      schemaVersion: SCHEMA_VERSION,
      builtAt: new Date().toISOString(),
      sources: healths,
      plugins,
    }
    await this.store.save(index)
    return index
  }

  /** 读取当前索引(不存在返回 null) */
  async loadIndex(): Promise<AtlasIndex | null> {
    return this.store.load()
  }

  /** 索引体检:条目数、构建时间、数据源状态、TTL、Top10 预览 */
  async status(ttlHours: number) {
    const index = await this.store.load()
    if (!index) return { exists: false, location: this.store.location }
    const top10 = index.plugins.filter((p) => !p.deadLink).slice(0, 10).map((p) => ({
      name: p.name,
      id: p.id,
      stars: p.stars,
      quality: p.quality?.total ?? 0,
      type: p.type,
    }))
    return {
      exists: true,
      location: this.store.location,
      pluginCount: index.plugins.length,
      builtAt: index.builtAt,
      stale: this.store.isStale(index, ttlHours),
      sources: index.sources,
      top10,
    }
  }
}
