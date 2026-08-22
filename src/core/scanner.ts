/**
 * 生态扫描器(M1):编排各数据源 → 去重合并 → 白名单标记 → 评分 → 落盘
 */
import { AtlasIndex, PluginMeta, PluginType, SourceHealth } from '../types'
import { rank } from './ranker'
import { EcosystemSource, RawPluginEntry } from './sources/types'
import { GitHubTopicSource } from './sources/github-topic'
import { AwesomeListSource, WHITELIST_REPOS } from './sources/awesome-list'
import { IndexStore, SCHEMA_VERSION } from './index-store'

/** 按仓库自述关键词的粗粒度类型推断;P2 升级为读仓库文件清单判定 */
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

export interface ScanOptions {
  token?: string
  /** 仅供测试注入:替换默认数据源 */
  sources?: EcosystemSource[]
}

export class Scanner {
  constructor(
    private readonly store: IndexStore,
    private readonly sources: EcosystemSource[] = [new GitHubTopicSource(), new AwesomeListSource()],
  ) {}

  async scan(options: ScanOptions = {}): Promise<AtlasIndex> {
    const sources = options.sources ?? this.sources
    const healths: SourceHealth[] = []
    // 以仓库 id 为键去重;GitHub topic 数据优先(star/时间更准),awesome 补白名单
    const merged = new Map<string, PluginMeta>()

    for (const source of sources) {
      const health: SourceHealth = {
        sourceId: source.id,
        ok: true,
        itemCount: 0,
        fetchedAt: new Date().toISOString(),
      }
      try {
        for await (const entry of source.collect(options.token)) {
          health.itemCount++
          const existing = merged.get(entry.id)
          if (!existing) {
            merged.set(entry.id, toMeta(entry, source.id))
            continue
          }
          // 合并:补齐缺失字段,标记白名单命中
          const updated: PluginMeta = {
            ...existing,
            stars: existing.stars || entry.stars,
            lastPushedAt: existing.lastPushedAt || entry.lastPushedAt,
            license: existing.license === 'unknown' ? entry.license : existing.license,
            whitelisted: existing.whitelisted || WHITELIST_REPOS.includes(entry.id),
          }
          merged.set(entry.id, updated)
        }
      } catch (err) {
        health.ok = false
        health.error = err instanceof Error ? err.message : String(err)
      }
      healths.push(health)
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

  /** 索引体检:条目数、构建时间、数据源状态、TTL */
  async status(ttlHours: number) {
    const index = await this.store.load()
    if (!index) return { exists: false, location: this.store.location }
    return {
      exists: true,
      location: this.store.location,
      pluginCount: index.plugins.length,
      builtAt: index.builtAt,
      stale: this.store.isStale(index, ttlHours),
      sources: index.sources,
    }
  }
}
