import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { IndexStore, SCHEMA_VERSION } from '../src/core/index-store.js'
import { backfillMetadata, needsBackfill, RepoFetcher } from '../src/core/metadata.js'
import { resolveGithubToken } from '../src/core/github.js'
import { AtlasIndex, PluginMeta } from '../src/types.js'

let dir: string
let store: IndexStore

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-meta-'))
  store = new IndexStore(dir)
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

function meta(p: Partial<PluginMeta>): PluginMeta {
  return {
    id: 'a/x', name: 'dsh-x', repoUrl: 'https://github.com/a/x', description: '',
    type: 'cordis', stars: 0, lastPushedAt: '', license: 'MIT', topics: [],
    whitelisted: false, provides: [], source: 'test', fetchedAt: '2026-08-01T00:00:00Z',
    ...p,
  }
}

function indexWith(plugins: PluginMeta[]): AtlasIndex {
  return { schemaVersion: SCHEMA_VERSION, builtAt: '2026-08-22T00:00:00Z', sources: [], plugins }
}

describe('resolveGithubToken(三级解析)', () => {
  it('优先配置指定名,其次 GITHUB_TOKEN/GH_TOKEN,无则匿名', () => {
    const cfg = { githubTokenEnv: 'DEEPATLAS_GITHUB_TOKEN' }
    process.env.DEEPATLAS_GITHUB_TOKEN = 'cfg-token'
    process.env.GITHUB_TOKEN = 'gh-token'
    expect(resolveGithubToken(cfg)).toBe('cfg-token')
    delete process.env.DEEPATLAS_GITHUB_TOKEN
    expect(resolveGithubToken(cfg)).toBe('gh-token')
    delete process.env.GITHUB_TOKEN
    process.env.GH_TOKEN = 'ghenv-token'
    expect(resolveGithubToken(cfg)).toBe('ghenv-token')
    delete process.env.GH_TOKEN
    expect(resolveGithubToken(cfg)).toBeUndefined()
  })
})

describe('needsBackfill(缓存策略)', () => {
  const now = Date.parse('2026-08-22T00:00:00Z')

  it('无 metadataFetchedAt 或缺数据 → 需要回填', () => {
    expect(needsBackfill(meta({}), now)).toBe(true)
    expect(needsBackfill(meta({ stars: 10, metadataFetchedAt: '2026-08-21T00:00:00Z' }), now)).toBe(false)
  })

  it('超过 7 天 → 需要刷新', () => {
    expect(needsBackfill(meta({ stars: 10, metadataFetchedAt: '2026-08-10T00:00:00Z' }), now)).toBe(true)
  })
})

describe('backfillMetadata(注入假 fetcher)', () => {
  it('补齐元数据、重算质量分并重排序', async () => {
    await store.save(indexWith([
      meta({ id: 'a/low', name: 'dsh-low' }),
      meta({ id: 'a/hot', name: 'dsh-hot' }),
    ]))
    const fetcher: RepoFetcher = async (id) => ({
      ok: true,
      data: {
        stars: id === 'a/hot' ? 5508 : 3,
        pushedAt: '2026-08-21T00:00:00Z',
        license: 'Apache-2.0',
        archived: false,
        fork: false,
        defaultBranch: 'main',
      },
    })
    const r = await backfillMetadata(store, { fetcher, token: undefined })
    expect(r.updated).toBe(2)
    const after = await store.load()
    expect(after!.plugins[0].id).toBe('a/hot') // 高分在前
    expect(after!.plugins[0].stars).toBe(5508)
    expect(after!.plugins[0].quality!.community).toBe(100)
    expect(after!.plugins.every((p) => p.metadataFetchedAt)).toBe(true)
  })

  it('rate-floor 命中即收手并说明原因', async () => {
    await store.save(indexWith([meta({ id: 'a/1' }), meta({ id: 'a/2' })]))
    const fetcher: RepoFetcher = async () => ({ ok: true, remaining: 30, data: {
      stars: 1, pushedAt: '2026-08-21T00:00:00Z', license: 'MIT', archived: false, fork: false, defaultBranch: 'main',
    } })
    const r = await backfillMetadata(store, { fetcher, token: undefined })
    expect(r.updated).toBe(1) // 第一条更新后见 remaining<50,第二条前收手
    expect(r.stoppedReason).toBe('rate-floor')
  })

  it('归档仓库 trust 降 20 分', async () => {
    await store.save(indexWith([meta({ id: 'a/arch', name: 'dsh-arch', license: 'MIT', whitelisted: false })]))
    const fetcher: RepoFetcher = async () => ({ ok: true, data: {
      stars: 100, pushedAt: '2026-08-21T00:00:00Z', license: 'MIT', archived: true, fork: false, defaultBranch: 'main',
    } })
    await backfillMetadata(store, { fetcher, token: undefined })
    const after = await store.load()
    // MIT(30) + dsh 前缀(20) - 归档(20) = 30
    expect(after!.plugins[0].quality!.trust).toBe(30)
  })
})
