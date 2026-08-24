import { describe, expect, it, vi } from 'vitest'
import { declaredSourceFiles, fetchArtifactAtCommit, normalizeRepositoryPath, resolveCommit } from '../src/core/github-artifacts.js'

describe('commit-pinned GitHub artifacts', () => {
  const sha = 'a'.repeat(40)

  it('分支只解析一次，后续 artifact 请求严格使用完整 SHA', async () => {
    const urls: string[] = []
    const fetcher = vi.fn(async (url: string) => {
      urls.push(url)
      if (url.includes('/commits/main')) return { ok: true, status: 200, json: async () => ({ sha }) }
      return { ok: true, status: 200, text: async () => 'publisher content' }
    }) as unknown as typeof fetch
    const commit = await resolveCommit('owner/plugin', 'main', undefined, undefined, fetcher)
    const result = await fetchArtifactAtCommit('owner/plugin', 'README.md', commit, undefined, undefined, fetcher)
    expect(commit).toBe(sha)
    expect(result.artifact).toMatchObject({ commit: sha, path: 'README.md', size: 17 })
    expect(result.artifact?.contentSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(urls[1]).toContain(`?ref=${sha}`)
    expect(urls[1]).not.toContain('HEAD')
    expect(urls[1]).not.toContain('main')
  })

  it('拒绝路径穿越、二进制与超大 artifact', async () => {
    expect(normalizeRepositoryPath('../secret')).toBeNull()
    expect(normalizeRepositoryPath('/root')).toBeNull()
    const binary = vi.fn(async () => ({ ok: true, status: 200, text: async () => 'a\0b' })) as unknown as typeof fetch
    expect((await fetchArtifactAtCommit('owner/plugin', 'index.js', sha, undefined, undefined, binary)).error).toContain('二进制')
    const large = vi.fn(async () => ({ ok: true, status: 200, text: async () => '12345' })) as unknown as typeof fetch
    expect((await fetchArtifactAtCommit('owner/plugin', 'index.js', sha, undefined, undefined, large, 4)).error).toContain('上限')
  })

  it('解析 main、conditional exports 与 bundle patch，并拒绝非法声明', () => {
    expect(declaredSourceFiles({ main: './lib/main.js', dsh: { bundle: { patch: './cordis.patch.yml' } } })).toEqual({
      files: ['lib/main.js', 'cordis.patch.yml'],
    })
    expect(declaredSourceFiles({ exports: { '.': { import: './lib/index.js', require: './lib/index.cjs' } } }).files).toEqual(['lib/index.js'])
    expect(declaredSourceFiles({ main: '../outside.js' }).error).toContain('非法')
    expect(declaredSourceFiles({ dsh: { bundle: {} } }).error).toContain('dsh.bundle.patch')
  })
})
