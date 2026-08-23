import { afterEach, describe, expect, it, vi } from 'vitest'
import { AwesomeListSource, AWESOME_LISTS } from '../src/core/sources/awesome-list.js'

afterEach(() => vi.unstubAllGlobals())

describe('official awesome-dsh-plugin source', () => {
  it('is included and parses the generated README entry format', async () => {
    expect(AWESOME_LISTS[0].repo).toBe('awesome-dsh-plugin/awesome-dsh-plugin')
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true,
      text: async () => url.includes('/repos/awesome-dsh-plugin/awesome-dsh-plugin/contents/README.md')
        ? '- [Owner/dsh-example](https://github.com/Owner/dsh-example) - Example plugin.\n'
        : '',
    })))

    const entries = []
    for await (const entry of new AwesomeListSource().collect()) entries.push(entry)

    expect(entries).toEqual([
      expect.objectContaining({
        id: 'owner/dsh-example',
        name: 'Owner/dsh-example',
        description: 'Example plugin.',
      }),
    ])
  })

  it('reports the aggregate source as failed when any configured list is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: !url.includes('/Dominic789654/'),
      status: url.includes('/Dominic789654/') ? 404 : 200,
      text: async () => '',
    })))

    const collect = async () => {
      for await (const _entry of new AwesomeListSource().collect()) { /* drain */ }
    }
    await expect(collect()).rejects.toThrow('awesome 清单读取不完整')
  })
})
