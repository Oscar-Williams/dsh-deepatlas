import { describe, expect, it } from 'vitest'
import {
  newPlan, approve, checkDuplicate, install, verifyComposed, markActiveIfBooted, isActive,
} from '../src/core/installplan.js'

const gates = { userConsent: true, audit: { level: 'green' as const }, compatibilityOk: true }

describe('InstallPlan 状态机', () => {
  it('完整正向链:RESOLVED→APPROVED→INSTALLED→COMPOSED→ACTIVE', async () => {
    let plan = newPlan('a/hot', 'web', 'abc123')
    expect(plan.state).toBe('RESOLVED')
    plan = approve(plan, gates)
    expect(plan.state).toBe('APPROVED')
    plan = checkDuplicate(plan, '- id: other', 'dsh-hot')
    expect(plan.state).toBe('APPROVED')
    plan = await install(plan, false, async () => ({ code: 0, output: 'Done in 500ms' }))
    expect(plan.state).toBe('INSTALLED')
    expect(plan.installCommand).toContain('#abc123')
    plan = verifyComposed(plan, '# == dsh-hot\n- id: hot\n  name: dsh-hot', 'dsh-hot')
    expect(plan.state).toBe('COMPOSED')
    plan = markActiveIfBooted(plan, true)
    expect(plan.state).toBe('ACTIVE')
    expect(isActive(plan)).toBe(true)
    // 时间线完整可审计
    expect(plan.trace.map((t) => t.to)).toEqual(['APPROVED', 'INSTALLED', 'COMPOSED', 'ACTIVE'])
  })

  it('四类拒绝:无同意/红审计/未锁 commit/不兼容', () => {
    const plan = newPlan('a/x', 'web', 'abc')
    expect(approve(plan, { ...gates, userConsent: false }).state).toBe('REJECTED_CONSENT')
    expect(approve(plan, { ...gates, audit: { level: 'red' } }).state).toBe('REJECTED_AUDIT')
    expect(approve(newPlan('a/x', 'web'), gates).state).toBe('REJECTED_UNPINNED')
    expect(approve(plan, { ...gates, compatibilityOk: false }).state).toBe('REJECTED_COMPAT')
  })

  it('装前查重:组合树已含目标行 → 拒绝(#2889)', () => {
    let plan = newPlan('a/dup', 'web', 'abc')
    plan = approve(plan, gates)
    plan = checkDuplicate(plan, "- id: dup\n  name: 'dsh-dup'", 'dsh-dup')
    expect(plan.state).toBe('REJECTED_DUPLICATE')
    expect(plan.detail).toContain('#2889')
  })

  it('组合验证按实际包名精确匹配,不接受名称子串', () => {
    let plan = approve(newPlan('a/foo', 'web', 'abc'), gates)
    expect(checkDuplicate(plan, "  name: 'dsh-foobar'", 'dsh-foo').state).toBe('APPROVED')
    plan = checkDuplicate(plan, "  name: '@scope/dsh-foo'", '@scope/dsh-foo')
    expect(plan.state).toBe('REJECTED_DUPLICATE')
  })

  it('非 APPROVED 状态拒绝执行安装', async () => {
    const plan = await install(newPlan('a/x', 'web', 'abc'), false, async () => ({ code: 0, output: '' }))
    expect(plan.state).toBe('RESOLVED')
    expect(plan.trace.at(-1)?.note).toContain('非 APPROVED')
  })

  it('dry-run 只生成命令;真实执行失败保留失败证据', async () => {
    let plan = approve(newPlan('a/x', 'web', 'abc'), gates)
    plan = await install(plan, true)
    expect(plan.state).toBe('PLANNED')
    expect(plan.installCommand).toContain('dsh plugin --profile web add github:a/x#abc')
    plan = approve(newPlan('a/y', 'web', 'abc'), gates)
    plan = await install(plan, false, async () => ({ code: 1, output: 'ERR_PNPM_FETCH_404 ...' }))
    expect(plan.state).toBe('FAILED')
    expect(plan.trace.at(-1)?.note).toContain('退出码 1')
  })

  it('dry-run 不进入组合验证', async () => {
    let plan = approve(newPlan('a/z', 'web', 'abc'), gates)
    plan = await install(plan, true)
    expect(plan.state).toBe('PLANNED')
  })
})
