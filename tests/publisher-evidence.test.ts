import { describe, expect, it, vi } from 'vitest'
import { hydratePublisherEvidence } from '../src/core/publisher-evidence.js'

describe('publisher evidence hydration', () => {
  it('manifest、README 与入口均固定在同一 commit，并报告完整覆盖', async () => {
    const sha = 'c'.repeat(40)
    const urls: string[] = []
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/commits/HEAD')) return { ok: true, status: 200, json: async () => ({ sha }) }
      if (url.includes('/contents?ref=')) return {
        ok: true, status: 200, json: async () => [
          { name: 'package.json', path: 'package.json', type: 'file' },
          { name: 'README.md', path: 'README.md', type: 'file' },
        ],
      }
      const text = url.includes('/contents/package.json')
        ? JSON.stringify({ name: 'dsh-browser', description: 'Browser helper', keywords: ['browser'], main: './lib/index.js', dsh: {} })
        : url.includes('/contents/README.md') ? '# Browser automation' : 'export function apply() {}'
      return { ok: true, status: 200, text: async () => text }
    }) as unknown as typeof fetch

    const result = await hydratePublisherEvidence('owner/plugin', { fetcher, observedAt: '2026-08-24T00:00:00.000Z' })
    expect(result.coverage).toMatchObject({
      status: 'complete', commit: sha,
      requiredRoles: ['entry:0', 'manifest', 'readme'],
      fetchedRoles: ['entry:0', 'manifest', 'readme'], errors: [],
    })
    expect(result.observations).toHaveLength(2)
    expect(result.observations.every((item) => item.provenance.ref?.value === sha)).toBe(true)
    expect(result.observations.every((item) => /^[0-9a-f]{64}$/.test(item.provenance.contentSha256 ?? ''))).toBe(true)
    expect(urls.filter((url) => url.includes('/contents')).every((url) => url.includes(`ref=${sha}`))).toBe(true)
  })

  it('声明入口缺失时保留已抓事实并标记 partial', async () => {
    const sha = 'd'.repeat(40)
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes('/contents?ref=')) return { ok: true, status: 200, json: async () => [{ name: 'package.json', path: 'package.json', type: 'file' }] }
      if (url.includes('/contents/package.json')) return { ok: true, status: 200, text: async () => JSON.stringify({ name: 'x', main: 'missing.js', dsh: {} }) }
      return { ok: false, status: 404, text: async () => '' }
    }) as unknown as typeof fetch
    const result = await hydratePublisherEvidence('owner/plugin', { ref: sha, fetcher })
    expect(result.coverage.status).toBe('partial')
    expect(result.coverage.errors[0]).toContain('entry:0')
    expect(result.observations).toHaveLength(1)
  })
})
