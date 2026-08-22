import { describe, expect, it } from 'vitest'
import { satisfiesRange, checkCompatibility, getRuntimeInfo, RuntimeInfo } from '../src/core/compat.js'

describe('satisfiesRange(迷你 semver)', () => {
  it('官方 engines 形态 "^22.19.0 || >=24.0.0"', () => {
    expect(satisfiesRange('22.23.2', '^22.19.0 || >=24.0.0')).toBe(true)
    expect(satisfiesRange('24.0.0', '^22.19.0 || >=24.0.0')).toBe(true)
    expect(satisfiesRange('22.18.0', '^22.19.0 || >=24.0.0')).toBe(false)
    expect(satisfiesRange('23.5.0', '^22.19.0 || >=24.0.0')).toBe(false)
  })

  it('单段范围:exact/脱字号/波浪号/大于等于/星号', () => {
    expect(satisfiesRange('22.19.0', '22.19.0')).toBe(true)
    expect(satisfiesRange('22.19.5', '^22.19.0')).toBe(true)
    expect(satisfiesRange('23.0.0', '^22.19.0')).toBe(false)
    expect(satisfiesRange('22.19.5', '~22.19.0')).toBe(true)
    expect(satisfiesRange('22.20.0', '~22.19.0')).toBe(false) // ~ 只允许同 minor 的补丁级变化
    expect(satisfiesRange('22.18.9', '~22.19.0')).toBe(false)
    expect(satisfiesRange('24.1.0', '>=24')).toBe(true)
    expect(satisfiesRange('23.9.0', '>=24')).toBe(false)
    expect(satisfiesRange('20.0.0', '*')).toBe(true)
  })
})

describe('checkCompatibility', () => {
  const runtime: RuntimeInfo = { platform: 'linux', arch: 'x64', nodeVersion: '24.0.0', packageManager: 'pnpm', dshVersion: 'unknown' }

  it('Node 不满足 engines → 硬性不兼容', () => {
    const r = checkCompatibility({ enginesNode: '^26.0.0', nativeDependencies: [], buildScripts: [] }, runtime)
    expect(r.ok).toBe(false)
    expect(r.node.pass).toBe(false)
    expect(r.reasons[0]).toContain('不满足')
  })

  it('native addon 产生平台提示但不阻断', () => {
    const r = checkCompatibility({ enginesNode: '>=22', nativeDependencies: ['koffi', 'node-pty'], buildScripts: [] }, runtime)
    expect(r.ok).toBe(true)
    expect(r.platform.note).toContain('koffi')
  })

  it('构建脚本触发 allowBuilds 提示', () => {
    const r = checkCompatibility({ enginesNode: undefined, nativeDependencies: [], buildScripts: ['prepare'] }, runtime)
    expect(r.build.required).toBe(true)
    expect(r.build.note).toContain('allowBuilds')
  })

  it('未声明 engines 视为 unknown 且不阻断', () => {
    const r = checkCompatibility({ enginesNode: undefined, nativeDependencies: [], buildScripts: [] }, runtime)
    expect(r.ok).toBe(true)
    expect(r.node.pass).toBe('unknown')
  })

  it('getRuntimeInfo 返回当前进程事实', () => {
    const info = getRuntimeInfo()
    expect(info.nodeVersion).toBe(process.versions.node)
    expect(['pnpm', 'npm', 'unknown']).toContain(info.packageManager)
  })
})
