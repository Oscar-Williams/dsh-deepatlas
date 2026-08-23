import { describe, expect, it } from 'vitest'
import { classifyKind, isInstallable } from '../src/core/kind.js'
import { buildInstallTool } from '../src/tools/install.js'
import { DeepAtlasConfig } from '../src/config.js'

describe('classifyKind(结构性实体分类,防 benchmark 泄漏)', () => {
  it('官方 harness → framework,不可安装', () => {
    expect(classifyKind({ id: 'deepseek-ai/deepseek-harness', name: 'deepseek-harness' })).toBe('framework')
    expect(isInstallable('framework')).toBe(false)
  })
  it('harness 的 fork 同视为 framework', () => {
    expect(classifyKind({ id: 'a/harness-fork', name: 'x', fork: true })).toBe('framework')
  })
  it('awesome 清单 → collection,不可安装', () => {
    expect(classifyKind({ id: 'a/awesome-dsh', name: 'awesome-dsh', description: 'curated list of plugins' })).toBe('collection')
    expect(isInstallable('collection')).toBe(false)
  })
  it('普通插件 → plugin,可安装', () => {
    expect(classifyKind({ id: 'a/dsh-mem', name: 'dsh-memory', description: '长期记忆插件' })).toBe('plugin')
    expect(isInstallable('plugin')).toBe(true)
  })
})

describe('TOCTOU 不变量(audit commit === install commit)', () => {
  const config: DeepAtlasConfig = {
    dataDir: '/tmp/x', installProfile: 'web', indexTtlHours: 24, minStars: 0,
    githubTokenEnv: 'T', dryRun: true,
  }
  it('审计 commit 与安装 commit 不一致 → 拒绝', async () => {
    const tool = buildInstallTool({} as never, config)
    const r = await (tool as { execute: (a: unknown) => Promise<{ ok: boolean; error?: string }> }).execute({
      target: 'a/hot', commit: 'abc123', auditLevel: 'green', userConsent: true, auditCommit: 'def456',
    })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('TOCTOU')
  })
})
