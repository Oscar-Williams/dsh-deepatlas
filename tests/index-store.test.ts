import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { IndexStore, SCHEMA_VERSION, defaultDataDir } from '../src/core/index-store.js'
import { AtlasIndex } from '../src/types.js'

let dir: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-test-'))
})

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true })
})

function sampleIndex(builtAt: string): AtlasIndex {
  return {
    schemaVersion: SCHEMA_VERSION,
    builtAt,
    sources: [{ sourceId: 'github-topic', ok: true, itemCount: 3, fetchedAt: builtAt }],
    plugins: [],
  }
}

describe('IndexStore', () => {

  it('uses the active DSH_HOME before the user-wide fallback', () => {
    const previousDeepAtlasHome = process.env.DEEPATLAS_HOME
    const previousDshHome = process.env.DSH_HOME
    delete process.env.DEEPATLAS_HOME
    process.env.DSH_HOME = path.join(os.tmpdir(), 'isolated-dsh-home')
    try {
      expect(defaultDataDir()).toBe(path.join(process.env.DSH_HOME, 'deepatlas'))
    } finally {
      if (previousDeepAtlasHome === undefined) delete process.env.DEEPATLAS_HOME
      else process.env.DEEPATLAS_HOME = previousDeepAtlasHome
      if (previousDshHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousDshHome
    }
  })
  it('save 后能 load 回来,字段无损', async () => {
    const store = new IndexStore(dir)
    await store.save(sampleIndex('2026-08-22T00:00:00Z'))
    const loaded = await store.load()
    expect(loaded?.schemaVersion).toBe(SCHEMA_VERSION)
    expect(loaded?.sources[0].itemCount).toBe(3)
  })

  it('文件不存在或损坏时 load 返回 null', async () => {
    const store = new IndexStore(dir)
    expect(await store.load()).toBeNull()
    await fs.writeFile(path.join(dir, 'index.json'), '{broken', 'utf8')
    expect(await store.load()).toBeNull()
  })

  it('schemaVersion 不匹配视为需重建', async () => {
    const store = new IndexStore(dir)
    await fs.writeFile(path.join(dir, 'index.json'), JSON.stringify({ ...sampleIndex('x'), schemaVersion: 999 }), 'utf8')
    expect(await store.load()).toBeNull()
  })

  it('TTL 过期判断正确', async () => {
    const store = new IndexStore(dir)
    const old = sampleIndex(new Date(Date.now() - 48 * 3600_000).toISOString())
    const fresh = sampleIndex(new Date().toISOString())
    expect(store.isStale(old, 24)).toBe(true)
    expect(store.isStale(fresh, 24)).toBe(false)
  })
})
