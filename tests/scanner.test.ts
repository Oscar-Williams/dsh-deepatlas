import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
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
  vi.unstubAllGlobals()
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

  it('数据源中途失败时丢弃该源已产生的部分条目', async () => {
    const partial: EcosystemSource = {
      id: 'github-topic',
      label: 'partial',
      async *collect() {
        yield entry({ id: 'a/partial' })
        throw new Error('incomplete_results')
      },
    }
    const scanner = new Scanner(store, [
      partial,
      fakeSource('awesome-list', [entry({ id: 'a/complete' })]),
    ])
    const index = await scanner.scan({ enrichTopN: 0 })
    expect(index.plugins.map((plugin) => plugin.id)).toEqual(['a/complete'])
    expect(index.sources[0]).toMatchObject({ ok: false, itemCount: 1 })
  })

  it('主发现源失败时保守合并旧索引,不被较小降级源覆盖', async () => {
    const oldPlugin = entry({ id: 'a/old', name: 'dsh-old' }) as PluginMeta
    await store.save(oldIndexWith([oldPlugin]))
    const scanner = new Scanner(store, [
      fakeSource('github-topic', [], new Error('rate limited')),
      fakeSource('awesome-list', [entry({ id: 'a/new', name: 'dsh-new' })]),
    ])
    const index = await scanner.scan({ enrichTopN: 0 })
    expect(index.plugins.map((plugin) => plugin.id).sort()).toEqual(['a/new', 'a/old'])
    expect(index.sources.find((source) => source.sourceId === 'github-topic')?.ok).toBe(false)
  })

  it('收到取消信号时不落盘', async () => {
    const controller = new AbortController()
    controller.abort(new DOMException('cancelled', 'AbortError'))
    const scanner = new Scanner(store, [fakeSource('github-topic', [entry({ id: 'a/x' })])])
    await expect(scanner.scan({ enrichTopN: 0, signal: controller.signal })).rejects.toThrow()
    expect(await store.load()).toBeNull()
  })

  it('头部候选的 publisher 观察值由同一固定 commit 进入索引', async () => {
    const sha = 'e'.repeat(40)
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/commits/HEAD')) return { ok: true, status: 200, json: async () => ({ sha }) }
      if (url.includes('/contents?ref=')) return {
        ok: true, status: 200, json: async () => [
          { name: 'package.json', path: 'package.json', type: 'file' },
          { name: 'README.md', path: 'README.md', type: 'file' },
        ],
      }
      const text = url.includes('package.json')
        ? JSON.stringify({ name: 'dsh-browser', description: 'Browser automation', keywords: ['browser'], main: 'index.js', dsh: {} })
        : url.includes('README.md') ? '# Browser automation' : 'export const apply = () => {}'
      return { ok: true, status: 200, text: async () => text }
    }))
    const scanner = new Scanner(store, [fakeSource('github-topic', [entry({ id: 'owner/repo', name: 'dsh-browser' })])])
    const index = await scanner.scan({ enrichTopN: 1 })
    const plugin = index.plugins[0]
    expect(plugin.publisherCoverage).toMatchObject({ status: 'complete', commit: sha })
    expect(plugin.observations?.filter((item) => item.provenance.authority === 'publisher')).toHaveLength(2)
    expect(plugin.evidence?.capabilities.find((claim) => claim.id === 'browser-automation')?.decision).toBe('accepted')
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
