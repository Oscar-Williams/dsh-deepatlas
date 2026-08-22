import { describe, expect, it } from 'vitest'
import { buildCommand, planInstall, executeInstall } from '../src/core/installer.js'
import { AuditReport } from '../src/types.js'

function report(level: AuditReport['level']): AuditReport {
  return {
    target: 'owner/repo',
    level,
    findings:
      level === 'red'
        ? [{ rule: 'lifecycle-scripts', level: 'red', evidence: 'postinstall', explanation: '安装期执行任意代码' }]
        : [],
    scope: ['test'],
    commitPinned: true,
    auditedAt: new Date().toISOString(),
  }
}

const base = {
  target: 'owner/repo',
  commit: 'abc1234',
  profile: 'web',
  audit: report('green'),
  userConsent: true,
}

describe('buildCommand', () => {
  it('生成锁定 commit 的 dsh plugin 安装命令', () => {
    expect(buildCommand(base)).toBe('dsh plugin --profile web add github:owner/repo#abc1234')
  })
})

describe('planInstall 安全闸门', () => {
  it('用户未同意 → 拒绝', () => {
    expect(planInstall({ ...base, userConsent: false }, true).allowed).toBe(false)
  })

  it('审计红色 → 拒绝并给出规则名', () => {
    const plan = planInstall({ ...base, audit: report('red') }, true)
    expect(plan.allowed).toBe(false)
    expect(plan.blockedReason).toContain('lifecycle-scripts')
  })

  it('未锁定 commit → 拒绝(供应链安全)', () => {
    expect(planInstall({ ...base, commit: undefined }, true).allowed).toBe(false)
  })

  it('同意 + 绿色 + 锁定 → 放行', () => {
    const plan = planInstall(base, true)
    expect(plan.allowed).toBe(true)
    expect(plan.command).toContain('#abc1234')
  })
})

describe('executeInstall', () => {
  it('dryRun 只返回命令文本,不真正执行', async () => {
    const plan = planInstall(base, true)
    await expect(executeInstall(plan)).resolves.toBe('[dry-run] dsh plugin --profile web add github:owner/repo#abc1234')
  })

  it('被闸门拦截时抛错', async () => {
    const plan = planInstall({ ...base, userConsent: false }, true)
    await expect(executeInstall(plan)).rejects.toThrow('未获得用户显式同意')
  })
})
