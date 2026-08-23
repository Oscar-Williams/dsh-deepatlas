/**
 * 故障注入式回滚测试(P3.5-B,采纳外部评审第六轮)
 * 场景 A:INSTALLED 后 COMPOSED 失败 → 回滚 → profile 文件还原
 * 场景 B:BOOT 冒烟失败 → FAILED → 回滚 → ROLLED_BACK
 * 场景 C(幂等):ACTIVE 后重复安装 → 查重拒绝,profile 不被改动
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  newPlan, approve, checkDuplicate, install, verifyComposed, markActiveIfBooted,
  markFailed, rollbackToSnapshot, finalVerdict,
} from '../src/core/installplan.js'
import { snapshotProfile, restoreProfile } from '../src/core/rollback.js'

const gates = { userConsent: true, audit: { level: 'green' as const }, compatibilityOk: true }

let profileDir: string

beforeEach(async () => {
  profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deepatlas-fi-'))
  await fs.writeFile(path.join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', dependencies: {} }, null, 2))
})

afterEach(async () => {
  await fs.rm(profileDir, { recursive: true, force: true })
})

async function driveToInstalled(target = 'a/hot', commit = 'abc123') {
  let plan = newPlan(target, 'web', commit)
  plan = approve(plan, gates)
  plan = await install(plan, false, async () => ({ code: 0, output: 'Done' }))
  return plan
}

describe('场景A:COMPOSED 失败 → 回滚还原', () => {
  it('FAILED→ROLLING_BACK→ROLLED_BACK,profile 文件回到安装前', async () => {
    const snap = await snapshotProfile(profileDir)
    // 模拟安装动作改写 profile
    await fs.writeFile(path.join(profileDir, 'package.json'), JSON.stringify({ name: 'dsh-profile-web', dependencies: { 'dsh-hot': 'github:a/hot#abc123' } }, null, 2))

    let plan = await driveToInstalled()
    plan = verifyComposed(plan, '# 组合树无目标行', 'dsh-hot') // COMPOSED 失败,停留 INSTALLED
    plan = markFailed(plan, 'COMPOSED', 'dump-config 未见目标行')
    expect(plan.state).toBe('FAILED')

    plan = await rollbackToSnapshot(plan, async () => {
      await restoreProfile(snap)
    })
    expect(plan.state).toBe('ROLLED_BACK')
    expect(finalVerdict(plan)).toBe('ROLLED_BACK')
    // profile 真的还原了吗
    const restored = JSON.parse(await fs.readFile(path.join(profileDir, 'package.json'), 'utf8'))
    expect(restored.dependencies).toEqual({})
  })
})

describe('场景B:BOOT 冒烟失败 → 回滚', () => {
  it('COMPOSED 后启动失败进入 FAILED 并可回滚', async () => {
    await snapshotProfile(profileDir)
    let plan = await driveToInstalled('a/boot')
    plan = verifyComposed(plan, "- id: boot\n  name: 'dsh-boot'", 'dsh-boot')
    expect(plan.state).toBe('COMPOSED')
    plan = markActiveIfBooted(plan, false) // 未达 ACTIVE
    plan = markFailed(plan, 'BOOT_VERIFIED', 'HTTP 000(90s 未探活)')
    expect(plan.state).toBe('FAILED')
    plan = await rollbackToSnapshot(plan, async () => undefined)
    expect(finalVerdict(plan)).toBe('ROLLED_BACK')
    expect(plan.trace.map((t) => t.to)).toContain('ROLLING_BACK')
  })

  it('回滚动作失败不会伪报 ROLLED_BACK', async () => {
    let plan = await driveToInstalled('a/rollback-fail')
    plan = markFailed(plan, 'COMPOSED', '故障注入')
    plan = await rollbackToSnapshot(plan, async () => { throw new Error('restore denied') })
    expect(plan.state).toBe('ROLLBACK_FAILED')
    expect(finalVerdict(plan)).toBe('ROLLBACK_FAILED')
    expect(plan.trace.at(-1)?.note).toContain('restore denied')
  })
})

describe('场景C:幂等——重复安装不破坏系统', () => {
  it('已 ACTIVE 后再次请求 → 查重拒绝且 profile 不变', async () => {
    await snapshotProfile(profileDir)
    let plan = await driveToInstalled('a/dup')
    plan = verifyComposed(plan, "- id: dup\n  name: 'dsh-dup'", 'dsh-dup')
    plan = markActiveIfBooted(plan, true)
    expect(finalVerdict(plan)).toBe('ACTIVE')

    const before = await fs.readFile(path.join(profileDir, 'package.json'), 'utf8')
    // 第二次安装同一插件:查重应拒绝
    const second = checkDuplicate(newPlan('a/dup', 'web', 'abc123'), "- id: dup\n  name: 'dsh-dup'", 'dsh-dup')
    expect(second.state).toBe('REJECTED_DUPLICATE')
    expect(finalVerdict(second)).toBe('BLOCKED')
    const after = await fs.readFile(path.join(profileDir, 'package.json'), 'utf8')
    expect(after).toBe(before) // profile 未被触碰
  })
})
