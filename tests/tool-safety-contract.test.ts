import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { buildAuditTool } from '../src/tools/audit.js'
import { AuditCache } from '../src/core/audit-cache.js'
import type { DeepAtlasConfig } from '../src/config.js'

let dir: string
let config: DeepAtlasConfig

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-tool-safety-'))
  config = {
    dataDir: dir, installProfile: 'web', indexTtlHours: 24,
    minStars: 0, githubTokenEnv: 'TEST_TOKEN', dryRun: true,
  }
})

afterEach(async () => {
  vi.unstubAllGlobals()
  await fs.rm(dir, { recursive: true, force: true })
})

describe('audit fail-closed contract', () => {
  it('rejects mutable refs before any network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await buildAuditTool({} as never, config).execute({ target: 'a/hot', commit: 'main' })
    expect(result).toMatchObject({ ok: false, level: 'red' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects malformed repository slugs before any network request', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const result = await buildAuditTool({} as never, config).execute({ target: 'a/hot --flag' })
    expect(result).toMatchObject({ ok: false, level: 'red' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not cache or permit a missing manifest', async () => {
    const sha = 'a'.repeat(40)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })))
    const result = await buildAuditTool({} as never, config).execute({ target: 'a/hot', commit: sha })
    expect(result).toMatchObject({ ok: false, level: 'red', auditedRef: sha })
    expect(await new AuditCache(dir).get('a/hot', sha)).toBeNull()
  })

  it('fetches the manifest-declared entry and bundle patch before caching', async () => {
    const sha = 'b'.repeat(40)
    const urls: string[] = []
    const manifest = {
      name: 'dsh-hot', version: '1.0.0', license: 'MIT', main: './lib/custom.js',
      dsh: { bundle: { patch: './config/deep.patch.yml' } },
    }
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      const text = url.includes('/contents/package.json')
        ? JSON.stringify(manifest)
        : url.includes('/contents/lib/custom.js')
          ? 'export function apply() {}'
          : '- insert: []'
      return { ok: true, status: 200, text: async () => text }
    }))

    const result = await buildAuditTool({} as never, config).execute({ target: 'a/hot', commit: sha })
    expect(result).toMatchObject({
      ok: true,
      auditedRef: sha,
      sourceCoverage: {
        required: ['lib/custom.js', 'config/deep.patch.yml'],
        fetched: ['lib/custom.js', 'config/deep.patch.yml'],
      },
    })
    expect(urls.some((url) => url.includes('/contents/lib/custom.js?ref='))).toBe(true)
    expect(urls.some((url) => url.includes('/contents/config/deep.patch.yml?ref='))).toBe(true)
    expect(await new AuditCache(dir).get('a/hot', sha)).not.toBeNull()
  })

  it('fails closed when a manifest-declared source file is unavailable', async () => {
    const sha = 'c'.repeat(40)
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ name: 'dsh-hot', version: '1.0.0', main: 'lib/missing.js' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => '' })
    vi.stubGlobal('fetch', fetchMock)

    const result = await buildAuditTool({} as never, config).execute({ target: 'a/hot', commit: sha })
    expect(result).toMatchObject({
      ok: false,
      level: 'red',
      sourceCoverage: { required: ['lib/missing.js'], fetched: [] },
    })
    expect(await new AuditCache(dir).get('a/hot', sha)).toBeNull()
  })
})
