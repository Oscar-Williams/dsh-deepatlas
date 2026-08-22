import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { Scanner } from '../src/core/scanner.js'
import { IndexStore, SCHEMA_VERSION } from '../src/core/index-store.js'
import { EcosystemSource, RawPluginEntry } from '../src/core/sources/types.js'
import { AtlasIndex, PluginMeta } from '../src/types.js'

let dir: string
let store: IndexStore

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-scan-'))
  store = new IndexStore(dir)
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

function entry(p: Partial<RawPluginEntry>): RawPluginEntry {
  return {
    id: 'owner/repo',
    name: 'dsh-demo',
    repoUrl: 'https://github.com/owner/repo',
    description: 'demo plugin',
    stars: 10,
    lastPushedAt: '2026-08-20T00:00:00Z',
    license: 'MIT',
    topics: ['dsh-plugin'],
    ...p,
  }
}

function fakeSource(id: string, entries: RawPluginEntry[], failWith?: Error): EcosystemSource {
  return {
    id,
    label: id,
    async *collect() {
      if (failWith) throw failWith
      for (const e of entries) yield e
    },
  }
}

function oldIndexWith(plugins: PluginMeta[]): AtlasIndex {
  return {
    schemaVersion: SCHEMA_VERSION,
    builtAt: '2026-08-01T00:00:00Z',
    sources: [{ sourceId: 'github-topic', ok: true, itemCount: plugins.length, fetchedAt: '2026-08-01T00:00:00Z' }],
    plugins,
  }
}

describe('Scanner 全量扫描', () => {
  it('多源去重合并:GitHub 数据优先补齐 awesome 缺失字段', async () => {
    const scanner = new Scanner(store, [
      fakeSource('github-topic', [entry({ id: 'a/x', name: 'dsh-x', stars: 100, description: '' })]),
      fakeSource('awesome-list', [entry({ id: 'a/x', name: 'X', stars: 0, description: 'awesome 描述', license: 'unknown' })]),
    ])
    const index = await scanner.scan({ enrichTopN: 0 })
    expect(index.plugins).toHaveLength(1)
    const p = index.plugins[0]
    expect(p.stars).toBe(100) // GitHub 的 star 保留
    expect(p.description).toBe('awesome 描述') // awesome 的描述补齐
    expect(p.whitelisted).toBe(false)
  })

  it('白名单仓库命中即标记,质量分降序排序', async () => {
    const scanner = new Scanner(store, [
      fakeSource('s', [
        entry({ id: 'awesome-dsh-plugin/awesome-dsh-plugin', name: 'whitelist-repo', stars: 50 }),
        entry({ id: 'a/hot', name: 'dsh-hot', stars: 2000, lastPushedAt: '2026-08-21T00:00:00Z' }),
      ]),
    ])
    const index = await scanner.scan({ enrichTopN: 0 })
    expect(index.plugins.find((p) => p.id === 'awesome-dsh-plugin/awesome-dsh-plugin')?.whitelisted).toBe(true)
    expect(index.plugins[0].id).toBe('a/hot') // 高分在前
    expect(index.plugins[0].quality?.total).toBeGreaterThan(0)
  })

  it('全量模式全部数据源失败:抛错且不落盘空索引', async () => {
    const scanner = new Scanner(store, [fakeSource('bad', [], new Error('boom'))])
    await expect(scanner.scan({ enrichTopN: 0 })).rejects.toThrow('全部数据源失败')
    expect(await store.load()).toBeNull()
  })

  it('单源失败降级继续,健康记录带错误信息', async () => {
    const scanner = new Scanner(store, [
      fakeSource('good', [entry({ id: 'a/ok' })]),
      fakeSource('bad', [], new Error('rate limited')),
    ])
    const index = await scanner.scan({ enrichTopN: 0 })
    expect(index.plugins).toHaveLength(1)
    expect(index.sources.find((s) => s.sourceId === 'bad')?.ok).toBe(false)
    expect(index.sources.find((s) => s.sourceId === 'bad')?.error).toContain('rate limited')
  })
})

describe('Scanner 增量扫描', () => {
  it('与旧索引合并:更新已有条目、保留未变化条目', async () => {
    await store.save(
      oldIndexWith([
        {
          ...({} as PluginMeta),
          id: 'a/old',
          name: 'dsh-old',
          repoUrl: 'https://github.com/a/old',
          description: '旧条目',
          type: 'cordis',
          stars: 5,
          lastPushedAt: '2026-07-01T00:00:00Z',
          license: 'MIT',
          topics: [],
          whitelisted: false,
          provides: [],
          source: 'github-topic',
          fetchedAt: '2026-08-01T00:00:00Z',
        },
      ]),
    )
    const scanner = new Scanner(store, [fakeSource('github-topic', [entry({ id: 'a/old', stars: 999 })])])
    const index = await scanner.scan({ incremental: true, enrichTopN: 0 })

    expect(index.plugins).toHaveLength(1)
    expect(index.plugins[0].stars).toBe(999) // 更新生效
    expect(index.plugins[0].description).toBe('demo plugin')
    expect(index.sources[0].mode).toBe('incremental')
  })

  it('增量模式:某源失败仍保留旧数据兜底', async () => {
    await store.save(oldIndexWith([]))
    const scanner = new Scanner(store, [fakeSource('bad', [], new Error('network down'))])
    const index = await scanner.scan({ incremental: true, enrichTopN: 0 })
    expect(index.plugins).toHaveLength(0)
    expect(index.sources[0].ok).toBe(false)
  })
})

describe('Scanner status Top10', () => {
  it('status 返回 top10 预览', async () => {
    const scanner = new Scanner(store, [
      fakeSource('s', [
        entry({ id: 'a/1', name: 'dsh-1', stars: 300 }),
        entry({ id: 'a/2', name: 'dsh-2', stars: 50 }),
      ]),
    ])
    await scanner.scan({ enrichTopN: 0 })
    const status = await scanner.status(24)
    expect(status.exists).toBe(true)
    expect(status.top10).toHaveLength(2)
    expect(status.top10![0].id).toBe('a/1')
  })
})
