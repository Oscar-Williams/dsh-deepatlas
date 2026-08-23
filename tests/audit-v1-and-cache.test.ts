import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { buildAuditReportV1, scanSourceSignals } from '../src/core/audit-v1.js'
import { AuditCache, cacheKey, AUDITOR_VERSION } from '../src/core/audit-cache.js'

describe('scanSourceSignals(risk signals,非安全判定)', () => {
  it('识别 child_process/eval/网络/写文件/native/凭据读取', () => {
    const sig = scanSourceSignals({
      'lib/index.js': 'import { exec } from "node:child_process"\nconst x = eval(code)',
      'lib/net.js': 'await fetch("https://x")',
      'lib/fs.js': 'fs.writeFileSync(p, d)',
      'lib/native.js': 'const k = require("koffi")',
    })
    const names = sig.map((s) => s.signal)
    expect(names).toContain('child-process')
    expect(names).toContain('dynamic-eval')
    expect(names).toContain('network-access')
    expect(names).toContain('filesystem-write')
    expect(names).toContain('native-binary')
  })

  it('elevated 信号升级 risk 为 elevated 并附措辞红线', () => {
    const r = buildAuditReportV1(
      { target: 'a/x', manifest: { license: 'MIT' }, commitPinned: true, whitelisted: true },
      { 'lib/index.js': 'require("child_process")' },
    )
    expect(r.risk.level).toBe('elevated')
    expect(r.risk.reasons.join()).toContain('risk signals')
  })

  it('红色清单规则仍优先于 elevated', () => {
    const r = buildAuditReportV1(
      { target: 'a/y', manifest: { scripts: { postinstall: 'x' } }, commitPinned: true, whitelisted: true },
      { 'lib/index.js': 'require("child_process")' },
    )
    expect(r.risk.level).toBe('red')
  })
})

describe('AuditCache(内容寻址)', () => {
  let dir: string
  let cache: AuditCache

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-ac-'))
    cache = new AuditCache(dir)
  })
  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true })
  })

  it('同 repo+commit 命中;commit 变更失效', async () => {
    const report = buildAuditReportV1({ target: 'a/b', manifest: null, commitPinned: true, whitelisted: false })
    await cache.put('a/b', 'sha1', report as never)
    expect(await cache.get('a/b', 'sha1')).not.toBeNull()
    expect(await cache.get('a/b', 'sha2')).toBeNull()
  })

  it('key 含审计版本,版本升级即失效(构造验证)', () => {
    const k1 = cacheKey('a/b', 'sha1')
    expect(k1).toHaveLength(24)
    expect(k1).not.toBe(cacheKey('a/b', 'sha2'))
    const manual = createHash('sha256').update(`a/b#sha1|audit-vX`).digest('hex').slice(0, 24)
    expect(cacheKey('a/b', 'sha1')).not.toBe(manual)
    expect(AUDITOR_VERSION).toBe('audit-v3')
  })
})
