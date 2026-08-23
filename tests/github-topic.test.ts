import { afterEach, describe, expect, it, vi } from 'vitest'
import { GitHubTopicSource } from '../src/core/sources/github-topic.js'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const repo = (partition: number, page: number, index: number) => ({
  full_name: `owner-${partition}/plugin-${page}-${index}`,
  name: `plugin-${page}-${index}`,
  html_url: `https://github.com/owner-${partition}/plugin-${page}-${index}`,
  description: 'DSH plugin',
  stargazers_count: 1,
  pushed_at: '2026-08-23T00:00:00Z',
  license: { spdx_id: 'MIT' },
  topics: ['dsh-plugin'],
})

describe('GitHub topic pagination', () => {
  it('partitions queries above the Search API limit and collects every leaf page', async () => {
    let root = true
    const partitions = new Map<string, number>()
    const fetchMock = vi.fn(async (url: string) => {
      const parsed = new URL(url)
      const page = Number(parsed.searchParams.get('page'))
      const query = parsed.searchParams.get('q') ?? ''
      if (root) {
        root = false
        return { ok: true, json: async () => ({ items: [], total_count: 1500 }) }
      }
      const range = query.split('created:')[1]
      if (!partitions.has(range)) partitions.set(range, partitions.size)
      const partition = partitions.get(range)!
      const count = page <= 7 ? 100 : 50
      return {
        ok: true,
        json: async () => ({
          items: Array.from({ length: count }, (_, index) => repo(partition, page, index)),
          total_count: 750,
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)

    const source = new GitHubTopicSource({ now: new Date('2026-08-23T00:00:00Z') })
    const entries = []
    for await (const entry of source.collect()) entries.push(entry)

    expect(entries).toHaveLength(1500)
    expect(partitions.size).toBe(2)
    expect(fetchMock).toHaveBeenCalledTimes(17)
    expect(source.reportedTotal).toBe(1500)
    expect(source.truncated).toBe(false)
  })

  it('uses stable creation-time partitioning plus a pushed filter for incremental collection', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ items: [repo(0, 1, 0)], total_count: 1 }),
    }))
    vi.stubGlobal('fetch', fetchMock)

    const source = new GitHubTopicSource({
      since: '2026-08-22T00:00:00Z',
      now: new Date('2026-08-23T00:00:00Z'),
    })
    const entries = []
    for await (const entry of source.collect()) entries.push(entry)

    expect(entries).toHaveLength(1)
    const query = new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')
    expect(query).toContain('created:2008-01-01T00:00:00Z..2026-08-23T00:00:00Z')
    expect(query).toContain('pushed:>2026-08-22T00:00:00Z')
  })

  it('retries incomplete GitHub Search responses before yielding data', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [repo(0, 1, 99)], total_count: 1, incomplete_results: true }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [repo(0, 1, 0)], total_count: 1, incomplete_results: false }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const collect = (async () => {
      const entries = []
      for await (const entry of new GitHubTopicSource({ now: new Date('2026-08-23T00:00:00Z') }).collect()) {
        entries.push(entry)
      }
      return entries
    })()
    await vi.runAllTimersAsync()

    await expect(collect).resolves.toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
