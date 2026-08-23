import { describe, expect, it } from 'vitest'
import { classifyKind, isInstallable } from '../src/core/kind.js'
import { buildInstallTool } from '../src/tools/install.js'
import { DeepAtlasConfig } from '../src/config.js'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { AuditCache } from '../src/core/audit-cache.js'
import { buildAuditReportV1 } from '../src/core/audit-v1.js'
import { buildPluginRecord } from '../src/core/record.js'

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
  const sha = 'a'.repeat(40)
  const otherSha = 'b'.repeat(40)
  const config: DeepAtlasConfig = {
    dataDir: '/tmp/x', installProfile: 'web', indexTtlHours: 24, minStars: 0,
    githubTokenEnv: 'T', dryRun: true,
  }
  const manifest = { name: 'hot', version: '1.0.0', license: 'MIT' }
  it('公开 schema 只接收目标、完整 commit 与用户同意', () => {
    const tool = buildInstallTool({} as never, config)
    expect(Object.keys(tool.parameters)).toEqual(['target', 'commit', 'userConsent'])
    expect('auditCommit' in tool.parameters).toBe(false)
    expect('auditLevel' in tool.parameters).toBe(false)
    expect('enginesNode' in tool.parameters).toBe(false)
  })

  it('无内容寻址审计缓存时拒绝安装', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-no-audit-'))
    try {
      const tool = buildInstallTool({} as never, { ...config, dataDir: dir })
      const r = await tool.execute({ target: 'a/hot', commit: sha, userConsent: true })
      expect(r).toMatchObject({ ok: false, plan: { state: 'REJECTED_AUDIT' } })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('一个 commit 的缓存不能授权另一个 commit', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-toctou-'))
    try {
      const report = {
        ...buildAuditReportV1({
          target: 'a/hot', commitPinned: true, whitelisted: true,
          manifest,
        }),
        auditedRef: sha,
        compatibility: { ok: true },
        pluginRecord: buildPluginRecord('a/hot', manifest),
      }
      await new AuditCache(dir).put('a/hot', sha, report)
      const tool = buildInstallTool({} as never, { ...config, dataDir: dir })
      const result = await tool.execute({ target: 'a/hot', commit: otherSha, userConsent: true })
      expect(result).toMatchObject({ ok: false, plan: { state: 'REJECTED_AUDIT' } })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('缓存报告的目标或 auditedRef 不匹配时拒绝授权', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-cache-identity-'))
    try {
      const report = {
        ...buildAuditReportV1({
          target: 'attacker/forged', commitPinned: true, whitelisted: true,
          manifest,
        }),
        auditedRef: otherSha,
        compatibility: { ok: true },
        pluginRecord: buildPluginRecord('attacker/forged', manifest),
      }
      await new AuditCache(dir).put('a/hot', sha, report)
      const tool = buildInstallTool({} as never, { ...config, dataDir: dir })
      const result = await tool.execute({ target: 'a/hot', commit: sha, userConsent: true })
      expect(result).toMatchObject({ ok: false, plan: { state: 'REJECTED_AUDIT' } })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('安装时按当前运行时重新计算缓存中的兼容要求', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-compat-refresh-'))
    try {
      const incompatibleManifest = { ...manifest, engines: { node: '>=99' } }
      const report = {
        ...buildAuditReportV1({
          target: 'a/hot', commitPinned: true, whitelisted: true,
          manifest: incompatibleManifest,
        }),
        auditedRef: sha,
        compatibility: { ok: true }, // 模拟旧运行时留下的结论
        pluginRecord: buildPluginRecord('a/hot', incompatibleManifest),
      }
      await new AuditCache(dir).put('a/hot', sha, report)
      const tool = buildInstallTool({} as never, { ...config, dataDir: dir })
      const result = await tool.execute({ target: 'a/hot', commit: sha, userConsent: true })
      expect(result).toMatchObject({ ok: false, plan: { state: 'REJECTED_COMPAT' } })
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })

  it('缓存审计与兼容性通过后,dry-run 只进入 PLANNED', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-audited-'))
    try {
      const report = {
        ...buildAuditReportV1({
          target: 'a/hot', commitPinned: true, whitelisted: true,
          manifest,
        }),
        auditedRef: sha,
        compatibility: { ok: true },
        pluginRecord: buildPluginRecord('a/hot', manifest),
      }
      await new AuditCache(dir).put('a/hot', sha, report)
      const tool = buildInstallTool({} as never, { ...config, dataDir: dir })
      const r = await tool.execute({ target: 'a/hot', commit: sha, userConsent: true })
      expect(r).toMatchObject({
        ok: true, dryRun: true, executed: false, composed: false, active: false,
        plan: { state: 'PLANNED' },
      })
      expect(r.plan.trace.at(-1)?.note).toContain('[dry-run]')
    } finally {
      await fs.rm(dir, { recursive: true, force: true })
    }
  })
})
